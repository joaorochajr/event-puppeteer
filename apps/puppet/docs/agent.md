# Agent loop and scheduling

The agent is the Puppet process systemd starts. It is a single-threaded loop: a pure state machine (`agent-schedule`) decides which task is due, the loop performs it and feeds the outcome back, and between tasks it waits on a termination signal and on the Wake-up broker's socket at once.

## Contents

- [Phases](#phases)
- [Main loop](#main-loop)
- [Cadence of an active Device](#cadence-of-an-active-device)
- [Request mix](#request-mix)
- [Request volume by phase](#request-volume-by-phase)
- [Connect backoff](#connect-backoff)
- [Termination without global state](#termination-without-global-state)
- [Capabilities at a glance](#capabilities-at-a-glance)

## Phases

Waiting in Pending is a normal, indefinite state (ADR-0002). Puppeteer's answer to each status check decides the phase, so an approval, a rejection or a reset takes effect on the next check. A 401 at any point sends the Puppet back to enrollment.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
stateDiagram-v2
    direction LR
    [*] --> Unenrolled : no stored credentials
    [*] --> Pending : credentials in MMKV
    Unenrolled --> Unenrolled : connect failed / backoff 5s..300s
    Unenrolled --> Pending : POST /devices/connect ok
    Pending --> Active : status active or offline
    Pending --> Rejected : status rejected
    Active --> Pending : status pending
    Active --> Rejected : status rejected
    Rejected --> Pending : status pending
    Pending --> Unenrolled : HTTP 401
    Active --> Unenrolled : HTTP 401
    Rejected --> Unenrolled : HTTP 401
    Active --> [*] : update installed, execv
    note right of Pending
        status every 15 s
        heartbeat every 20 s
    end note
    note right of Active
        status 60 s, heartbeat 20 s, feed 300 s
        Commands on events (Wake-up, heartbeat flag)
        Wake-up broker connection
    end note
    note left of Rejected
        status every 3600 s only
    end note
```

## Main loop

When several tasks are due, the lowest bit wins: connect, then status, heartbeat, Commands, feed and the broker tasks. Termination is noticed at every wait. The Terminal role (any run not started by systemd) never reaches this loop; see [Installation](installation.md).

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
flowchart TD
    start([Process start]):::ok --> role{"Started by systemd from<br/>/opt/dsrs-puppet/puppet?"}
    role -->|no| terminal(["Terminal: install, repair or report<br/>see installation.md"]):::core
    role -->|yes| block["Block SIGTERM, SIGINT, SIGHUP<br/>(signalfd)"]:::shell
    block --> lock{"Agent lock free?"}
    lock -->|no| exitLock([exit 6 or 7]):::danger
    lock -->|yes| configure["Resolve configuration"]:::core
    configure -->|invalid| exitConfig([exit 1]):::danger
    configure --> init["Open MMKV, HTTP client<br/>and the MQTT library"]:::shell
    init --> load{"Stored<br/>credentials?"}
    load -->|yes| pending["schedule = Pending"]:::core
    load -->|no| unenrolled["schedule = Unenrolled"]:::core
    pending --> due
    unenrolled --> due
    due{"Any task due?"}
    due -->|yes| perform["Perform lowest-bit task<br/>connect > status > heartbeat ><br/>Commands > feed > broker"]:::shell
    perform --> restart{"Update<br/>installed?"}
    restart -->|yes| exec(["Flush logs, keep the lock,<br/>execv the new binary"]):::ok
    restart -->|no| wait
    due -->|no| wait["poll(signalfd, broker socket)<br/>timeout = min(next due, 60 s,<br/>1 s while the broker is open)"]:::shell
    wait -->|termination signal| stop([Graceful shutdown, exit 0]):::ok
    wait -->|socket readable or timeout| serve["Serve the broker:<br/>Wake-up, subscribed, lost"]:::shell
    serve --> due
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Cadence of an active Device

Intervals after approval: status 60 s, heartbeat 20 s (Puppeteer marks a Device offline after 60 s of silence), feed 300 s. Commands have no timer: they are fetched when the Device becomes active, whenever a heartbeat answer says some are waiting, whenever a Wake-up is heard and after every (re)subscription to the broker ([Wake-ups](wakeup.md)).

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
gantt
    title First two minutes after approval (idle, no Commands)
    dateFormat HH:mm:ss
    axisFormat %M:%S
    tickInterval 20second
    section Status (60 s)
        check :milestone, s0, 00:00:00, 0s
        check :milestone, s1, 00:01:00, 0s
        check :milestone, s2, 00:02:00, 0s
    section Heartbeat (20 s)
        beat :milestone, h0, 00:00:00, 0s
        beat :milestone, h1, 00:00:20, 0s
        beat :milestone, h2, 00:00:40, 0s
        beat :milestone, h3, 00:01:00, 0s
        beat :milestone, h4, 00:01:20, 0s
        beat :milestone, h5, 00:01:40, 0s
        beat :milestone, h6, 00:02:00, 0s
    section Commands (events)
        fetch on becoming active :milestone, c0, 00:00:00, 0s
        fetch after subscribing :milestone, c1, 00:00:02, 0s
        nothing to poll :active, c2, 00:00:02, 118s
    section Feed (300 s)
        refresh :milestone, f1, 00:00:00, 0s
        next refresh at 5 min :f2, 00:00:00, 120s
    section Wake-up broker
        connect and subscribe :milestone, b0, 00:00:00, 0s
        listening :active, b1, 00:00:02, 118s
```

## Request mix

An idle active Device makes about 252 small requests per hour, down from about 612 when it also polled Commands every 10 s. The MQTT connection is not a Puppeteer request.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'pie1': '#4f46e5', 'pie2': '#10b981', 'pie3': '#f59e0b', 'pie4': '#94a3b8', 'pieStrokeColor': '#ffffff', 'pieSectionTextColor': '#ffffff', 'pieTitleTextColor': '#1e293b', 'pieLegendTextColor': '#334155', 'pieOuterStrokeColor': '#e2e8f0',
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
pie showData
    title Requests per hour of an idle active Device (252 total)
    "Heartbeats (20 s)" : 180
    "Status checks (60 s)" : 60
    "Feed refreshes (300 s)" : 12
```

## Request volume by phase

Requests per hour for an idle Device in each phase.

```mermaid
%%{init: {'theme': 'base', 'sankey': {'showValues': true}, 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
sankey-beta

Active Device,Heartbeats,180
Active Device,Status checks,60
Active Device,Feed refreshes,12
Pending Device,Status checks,240
Pending Device,Heartbeats,180
Rejected Device,Status checks,1
```

## Connect backoff

Failed connects back off exponentially from 5 s up to a 300 s cap (bars). Up to 50% random jitter is added so a fleet does not reconnect in lockstep after an outage (line: worst case).

```mermaid
%%{init: {'theme': 'base', 'xyChart': {'width': 820, 'height': 420}, 'themeVariables': {'xyChart': {'plotColorPalette': '#4f46e5, #f59e0b'},
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
xychart-beta
    title "Connect retry delay after consecutive failures (seconds)"
    x-axis "Consecutive failures" [1, 2, 3, 4, 5, 6, 7, 8]
    y-axis "Delay (s)" 0 --> 460
    bar [5, 10, 20, 40, 80, 160, 300, 300]
    line [7, 15, 30, 60, 120, 240, 450, 450]
```

## Termination without global state

Signals are blocked and collected through a `signalfd`, so there is no signal handler and no mutable global flag; in-flight requests always finish. One `poll` waits for the signal and the broker socket together.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#4f46e5', 'primaryTextColor': '#ffffff',
  'primaryBorderColor': '#3730a3', 'lineColor': '#94a3b8',
  'secondaryColor': '#10b981', 'tertiaryColor': '#f59e0b',
  'background': '#ffffff', 'mainBkg': '#f8fafc',
  'nodeBorder': '#cbd5e1', 'clusterBkg': '#f1f5f9',
  'clusterBorder': '#e2e8f0', 'titleColor': '#1e293b',
  'edgeLabelBackground': '#ffffff', 'textColor': '#334155',
  'actorBkg': '#4f46e5', 'actorBorder': '#3730a3', 'actorTextColor': '#ffffff',
  'signalColor': '#64748b', 'signalTextColor': '#334155',
  'activationBkgColor': '#e0e7ff', 'activationBorderColor': '#6366f1',
  'noteBkgColor': '#fef3c7', 'noteBorderColor': '#f59e0b', 'noteTextColor': '#78350f',
  'labelBoxBkgColor': '#f1f5f9', 'labelBoxBorderColor': '#cbd5e1',
  'loopTextColor': '#334155', 'sequenceNumberColor': '#ffffff'
}}}%%
sequenceDiagram
    autonumber
    participant systemd as systemd / user
    participant kernel as Kernel
    participant agentLoop as Agent loop
    participant child as systemctl child

    agentLoop->>kernel: sigprocmask(SIG_BLOCK, TERM INT HUP)
    agentLoop->>kernel: signalfd(set)
    agentLoop->>kernel: poll(signalfd, broker socket, timeout)
    systemd->>kernel: SIGTERM
    Note over kernel: blocked, so it stays pending.<br/>No handler, no global flag.<br/>The signalfd becomes readable
    kernel-->>agentLoop: poll returns, termination requested
    agentLoop->>agentLoop: finish current request, close broker, MMKV and curl
    agentLoop-->>systemd: exit 0
    Note over agentLoop,child: Children spawn with POSIX_SPAWN_SETSIGMASK<br/>and an empty mask, so they still receive signals
    agentLoop->>child: posix_spawnp(systemctl ...)
```

## Capabilities at a glance

Everything the Puppet does, grouped by concern.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
mindmap
    root((Puppet))
        Installation
            One binary, one command
            Verified against the system
            Elevation: sudo, pkexec, su
            Terminal watches the agent
        Enrollment
            Auto-discovery connect
            Superadmin queue
            Credentials in MMKV
            Re-enroll on 401
        Liveness
            Heartbeat 20 s
            Errors in heartbeat
            Log queue to Puppeteer
            stderr for journald
        Commands
            request_telemetry
            restart and shutdown
            update
            Wake-up over MQTT
            commandsWaiting flag
            At-least-once delivery
        Feed
            Refresh every 5 min
            Validated before storing
            Stored for a future display
        Robustness
            Backoff with jitter
            One agent per Device
            Device Audit Trail
            Signals without globals
            Atomic self-update
        Quality
            Functional core
            Ten unit suites
            -Werror on ARM32
```
