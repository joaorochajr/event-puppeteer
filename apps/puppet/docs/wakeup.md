# Wake-ups

How a Command reaches a Puppet in well under a second, and what happens when the shortcut breaks. The decision is recorded in the monorepo's [ADR-0001](../../../docs/adr/0001-wake-up-over-public-mqtt-broker.md).

## Contents

- [Delivery](#delivery)
- [When Commands are fetched](#when-commands-are-fetched)
- [Broker connection](#broker-connection)
- [Reconnect backoff](#reconnect-backoff)
- [Outages](#outages)
- [Settings and trust](#settings-and-trust)

## Delivery

When Puppeteer stores a Command it publishes an empty **Wake-up** on a public MQTT broker, topic `<deviceId>/<organizationId>`. The Puppet is subscribed to it and fetches its Commands as soon as it hears one. The broker is only an accelerator: the heartbeat answer says whether Commands are waiting, so a missed Wake-up costs at most one heartbeat (20 s).

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
    actor admin as Admin
    participant show as puppet-show
    participant api as Puppeteer
    participant broker as MQTT broker
    participant puppet as Puppet

    Note over puppet,broker: Clean session, subscribed to deviceId/organizationId (QoS 1)
    admin->>show: Send a Command
    show->>api: POST /organizations/:org/devices/:id/commands
    Note over api: status = pending
    api->>broker: PUBLISH deviceId/organizationId (empty, QoS 1, not retained)
    api-->>show: 201 Command + wakeup {sent: true}
    broker-->>puppet: PUBLISH (empty)
    puppet->>api: GET /devices/:id/commands/pending
    api-->>puppet: [Command] and status = sent
    puppet->>api: POST .../ack
    puppet->>puppet: execute
    puppet->>api: POST .../complete {success}
    alt the broker is down or the Wake-up is lost
        api-->>show: 201 Command + wakeup {sent: false, reason}
        Note over puppet,api: Nothing is lost: the next heartbeat answer<br/>carries commandsWaiting = true
        puppet->>api: POST /devices/:id/heartbeat
        api-->>puppet: {success: true, commandsWaiting: true}
        puppet->>api: GET /devices/:id/commands/pending
    end
```

## When Commands are fetched

Commands are never fetched on a timer. These are the only triggers, all of which make a fetch due at once:

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
    boot(["Device becomes active<br/>(boot or approval)"]):::ok --> due
    flag(["Heartbeat answer:<br/>commandsWaiting = true"]):::core --> due
    heard(["Wake-up heard"]):::core --> due
    subscribed(["Broker subscription<br/>acknowledged"]):::core --> due
    bad(["Heartbeat answer without<br/>a boolean commandsWaiting"]):::danger --> failed["Logged as an error,<br/>heartbeat counted as failed,<br/>no value assumed"]:::danger
    due["Fetch Commands now<br/>(nextCommandFetchAt = now)"]:::shell --> get["GET /devices/:id/commands/pending"]:::shell
    get --> run["ack, execute, complete<br/>each Command in order"]:::shell
    timer["No timer:<br/>Commands are never polled"]:::external -.-> due
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Broker connection

The schedule tracks how far the connection has come. It never marks the Device unhealthy because of the broker; it only retries.

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
    [*] --> Disconnected
    Disconnected --> Connecting : active in an Organization, attempt due
    Connecting --> Subscribed : subscription acknowledged
    Connecting --> Disconnected : connection failed or silent for 20 s
    Subscribed --> Disconnected : connection lost
    Subscribed --> Connecting : Organization changed, move to the new topic
    Connecting --> Disconnected : left the active phase
    Subscribed --> Disconnected : left the active phase
    note right of Disconnected
        reconnects after 10 s, doubling up to 300 s,
        plus up to 50% jitter
    end note
    note right of Subscribed
        each acknowledged subscription makes one
        Command fetch due, to catch Wake-ups
        sent while the Puppet could not hear
    end note
```

## Reconnect backoff

Reconnection starts at 10 s and doubles to a 300 s cap. Up to 50% of random jitter is added so a fleet does not reconnect in lockstep after a broker outage.

```mermaid
%%{init: {'theme': 'base', 'xyChart': {'width': 820, 'height': 420}, 'themeVariables': {'xyChart': {'plotColorPalette': '#4f46e5, #f59e0b'},
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
xychart-beta
    title "Broker reconnect delay after consecutive failures (seconds)"
    x-axis "Consecutive failures" [1, 2, 3, 4, 5, 6, 7, 8]
    y-axis "Delay (s)" 0 --> 460
    bar [10, 20, 40, 80, 160, 300, 300, 300]
    line [15, 30, 60, 120, 240, 450, 450, 450]
```

## Outages

However many attempts an outage takes, the Puppet writes one error line when it starts and one info line when the broker is back. Admins read both in the Device's logs.

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
    participant looper as Agent loop
    participant broker as MQTT broker
    participant logs as Log queue
    participant api as Puppeteer

    loop each attempt of one outage
        looper->>broker: connect
        broker--xlooper: refused or timed out
        Note over looper: reconnect after 10 s, 20 s, 40 s... up to 300 s
    end
    looper->>logs: one error line for the whole outage
    Note over looper,api: The heartbeat is NOT degraded:<br/>Commands still arrive through commandsWaiting
    looper->>broker: connect
    broker-->>looper: CONNACK, subscription acknowledged
    looper->>logs: one info line: broker is back
    looper->>api: GET /devices/:id/commands/pending
    Note over looper,api: catches Wake-ups sent during the outage
```

## Settings and trust

- Host, port and TLS are compile-time constants: CMake options `PUPPET_WAKEUP_BROKER_HOST` (default `broker.hivemq.com`), `PUPPET_WAKEUP_BROKER_PORT` (`8883`) and `PUPPET_WAKEUP_BROKER_TLS` (`ON`). With TLS on, the broker's certificate is verified against the system store.
- Puppeteer publishes to a fixed broker (`WAKEUP_BROKER_URL` in `apps/puppeteer/src/io/wakeup/mqtt.ts`), so a build that changes these options must change it too, or the Puppet never hears a Wake-up and falls back to the heartbeat.
- The topic is not secret: anyone who learns it can see when a Device is woken up or send it a fake Wake-up. The worst case is one extra authenticated fetch, because the Wake-up carries nothing and Commands are fetched over HTTPS with the Device token.
- libmosquitto (v2.0.11) is linked statically, so a Device needs no MQTT library and a Puppet that updates itself never depends on one the Device may lack. The loop is single-threaded: the library's network loop is driven from outside, and the one blocking moment is the hostname lookup when a connection starts.
