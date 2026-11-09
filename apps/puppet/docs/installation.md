# Installation

How a technician puts the Puppet on a Device with one binary and one command, how it repairs itself, and the files it leaves behind. The decision is in [ADR-0001](adr/0001-self-installing-binary-configured-at-compile-time.md); the step-by-step is in the [README](../README.md#running-the-application-the-installation).

## Contents

- [Two roles, one binary](#two-roles-one-binary)
- [What is checked](#what-is-checked)
- [Elevation and repair](#elevation-and-repair)
- [A fresh Installation](#a-fresh-installation)
- [Watching the agent](#watching-the-agent)
- [Where things live](#where-things-live)
- [Only one agent](#only-one-agent)
- [Device Audit Trail](#device-audit-trail)

## Two roles, one binary

Which role a process plays is decided from how it was started, never from a flag. The only environment variables the Puppet reads say who started it: `INVOCATION_ID` (systemd) and `SUDO_USER`/`PKEXEC_UID` (the technician).

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
    run(["./puppet or systemd starts the binary"]):::ok --> invocation{"INVOCATION_ID set<br/>(systemd started it)?"}
    invocation -->|no| terminal(["Terminal"]):::shell
    invocation -->|yes| path{"Running from<br/>/opt/dsrs-puppet/puppet?"}
    path -->|no| terminal
    path -->|yes| agent(["Agent"]):::core
    terminal --> does["Checks the Installation, repairs it,<br/>reports status, watches the Agent.<br/>Never takes the lock, never becomes the Agent."]:::external
    agent --> loop["Agent lock, configuration, storage,<br/>then the loop (agent.md)"]:::external
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## What is checked

Whether the Puppet is installed is never stored. Every run compares three pieces with the system, so a flag can never disagree with reality. A valid installed binary is never replaced by a terminal run, even when it differs from the one running: only self-update changes it, so an old copy on a USB stick cannot downgrade a Device.

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
    start(["Terminal run"]):::ok --> diagnose["Check three pieces against the system"]:::core
    diagnose --> binary{"/opt/dsrs-puppet/puppet is an ELF<br/>for this architecture?"}
    diagnose --> unit{"Unit file exists with<br/>exactly the expected content?"}
    diagnose --> enabled{"dsrs-puppet.service enabled?"}
    binary -->|yes| all
    unit -->|yes| all
    enabled -->|yes| all
    all{"All three hold?"}
    all -->|yes| status["Print status summary:<br/>version, service state, Enrollment state,<br/>Device identifier"]:::ok
    status --> done0(["exit 0, nothing written,<br/>no password"]):::ok
    binary -->|no| repair
    unit -->|no| repair
    enabled -->|no| repair
    repair["Repair only the diverging pieces"]:::shell --> elevate["Re-run as root<br/>(next diagram)"]:::shell
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Elevation and repair

The password is always typed by a person, never embedded in the binary. Each way is announced on the terminal before it asks for anything. `sudo` is tried first because only it knows (a group, or a sudoers entry) whether your user may; `pkexec` lets a user without sudo rights authenticate as an administrator; `su` is the last resort and needs the root password, so it fails where Debian locked root.

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
    need["A repair is needed"]:::core --> root{"Already root?"}
    root -->|yes| work
    root -->|no| sudo{"sudo -v accepts<br/>your user?"}
    sudo -->|yes| viaSudo["Re-run through sudo<br/>(your own password)"]:::shell
    sudo -->|no| pk{"pkexec installed?"}
    pk -->|yes| viaPk["Re-run through pkexec<br/>(an administrator's password)"]:::shell
    pk -->|no| viaSu["Re-run through su<br/>(root password)"]:::shell
    viaPk -->|did not authorize| viaSu
    viaSu -->|none could start| fail(["exit 9, nothing changed"]):::danger
    viaSudo --> work
    viaPk --> work
    viaSu --> work
    work["As root: create directories,<br/>copy binary, write unit, enable, (re)start"]:::shell --> trail["Append each change<br/>to the Audit Trail"]:::store
    trail --> watch["Watch the agent<br/>(below)"]:::core
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## A fresh Installation

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
    actor tech as Technician
    participant term as Terminal (./puppet)
    participant root as Same binary, as root
    participant sys as systemd
    participant agent as Agent
    participant log as journalctl
    participant api as Puppeteer

    tech->>term: ./puppet
    term->>term: diagnose: nothing is installed
    term->>tech: "elevating through sudo" (or pkexec, su)
    term->>root: re-run with the same arguments
    root->>root: create /opt/dsrs-puppet and /var/lib/dsrs-puppet
    root->>root: copy itself to /opt/dsrs-puppet/puppet (temp file, rename)
    root->>root: write dsrs-puppet.service, systemctl daemon-reload
    root->>sys: enable, then start
    root->>root: append directories, binary, unit and service changes to the Audit Trail
    sys->>agent: start /opt/dsrs-puppet/puppet
    root->>log: follow the service journal (from now)
    agent->>api: POST /devices/connect
    agent->>log: "[info] enrollment: pending"
    log-->>root: line seen
    root-->>tech: summary: connected, pending, Device identifier
    Note over tech,agent: Closing the terminal ends only the watch.<br/>The agent belongs to systemd.
```

## Watching the agent

After a repair or install the terminal stays on as a read-only observer so the technician sees on site whether the Device works. It never takes the agent lock and never opens the agent's storage.

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
    [*] --> Watching : after an install or repair
    Watching --> Watching : any other agent line
    Watching --> Watching : "[error] ..." kept for the timeout message
    Watching --> Pending : agent logs the Device is pending (or approved)
    Watching --> TimedOut : 60 s without it
    Pending --> [*] : summary, exit 0
    TimedOut --> [*] : last error shown, exit 11
    note right of Watching
        evidence is the agent's own log from the start
        of the watch, never a stored record that could
        predate this run
    end note
```

## Where things live

Every name visible to the operating system carries the `dsrs-` prefix, so it never collides with Debian's `puppet` package. The data directory must be on persistent storage: losing it makes the Device enroll again as a new pending Device.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
flowchart LR
    subgraph opt["/opt/dsrs-puppet"]
        binary["puppet<br/>the one installed binary"]:::core
    end
    subgraph etc["/etc/systemd/system"]
        unit["dsrs-puppet.service<br/>waits for network-online.target,<br/>runs as root, Restart=always,<br/>WantedBy=multi-user.target"]:::shell
    end
    subgraph data["/var/lib/dsrs-puppet (persistent)"]
        mmkv[("MMKV files<br/>device.id, device.token, feed.events")]:::store
        trail[("audit-trail.jsonl<br/>append-only")]:::store
    end
    subgraph run["/run"]
        lock["dsrs-puppet.lock<br/>flock, released by the kernel"]:::external
    end
    unit -->|ExecStart| binary
    binary --> mmkv
    binary --> trail
    binary --> lock
    machine["/etc/machine-id<br/>the Device identity"]:::external --> binary
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Only one agent

The kernel releases the lock when the process dies, and the descriptor survives the self-update `execv`, so the restart is never raced.

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
    participant a as Agent A (running)
    participant file as /run/dsrs-puppet.lock
    participant b as Agent B (second start)
    participant kernel as Kernel

    a->>file: open, flock(LOCK_EX | LOCK_NB)
    file-->>a: held
    b->>file: open, flock(LOCK_EX | LOCK_NB)
    file-->>b: would block
    b->>b: exit 6, another agent is already running
    Note over a: update installed
    a->>file: keepAcrossRestart (descriptor survives execv)
    a->>a: execv new binary, same PID
    Note over a,b: No second agent can start in between
    a--xkernel: crash or kill
    kernel->>file: releases the lock
    Note over file: a crash never leaves a stale lock
```

## Device Audit Trail

Every change the Puppet makes to the Device is appended to `/var/lib/dsrs-puppet/audit-trail.jsonl`. The file is only ever appended to, concurrent writers produce separate intact lines, and resuming stored credentials is not an Enrollment change, so a restart records nothing by itself.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
flowchart LR
    term["Terminal<br/>who = user (SUDO_USER or PKEXEC_UID)"]:::shell --> append
    agent["Agent<br/>who = agent"]:::core --> append
    cmd["Executed Command<br/>who = command (id)"]:::core --> append
    append["Append one JSON line<br/>when, who, what, before, after<br/>(flock, fsync)"]:::shell --> file[("audit-trail.jsonl")]:::store
    file --> summary["Installation status summary:<br/>last binary version, last Enrollment state"]:::ok
    failed["A failed write"]:::danger -.->|logged as an error,<br/>the work goes on| append
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

```json
{"when":"2026-01-02T03:04:05Z","who":{"kind":"command","identifier":"<command id>"},"what":"binary","before":"0.0.1","after":"0.0.2 sha256:<hex>"}
```
