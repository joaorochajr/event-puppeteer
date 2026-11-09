# Device protocol

Every exchange between Puppet and Puppeteer. Request bodies and responses are encoded and decoded by the pure `protocol` module on top of the allocation-free `json` module. Commands are announced by a [Wake-up](wakeup.md) and fetched over this protocol.

## Contents

- [Enrollment](#enrollment)
- [Heartbeat and logs](#heartbeat-and-logs)
- [Revoked credentials](#revoked-credentials)
- [Command lifecycle](#command-lifecycle)
- [Command status on Puppeteer](#command-status-on-puppeteer)
- [Command dispatch](#command-dispatch)
- [Data model](#data-model)
- [JSON token layout](#json-token-layout)

## Enrollment

Zero-touch: the Puppet announces itself and waits. It sends no Organization, so every Device appears in the Superadmin's pending queue. A Device that reconnects with the same identifier while still pending reuses its row.

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
    participant puppet as Puppet
    participant store as MMKV
    participant api as Puppeteer
    actor admin as Admin

    puppet->>store: loadCredentials()
    store-->>puppet: none
    puppet->>api: POST /devices/connect {identifier}
    Note over api: Same identifier still pending?<br/>reuse row and rotate token
    api-->>puppet: 200 {device: {id, status: pending}, token}
    puppet->>store: saveCredentials() + sync to disk
    puppet->>puppet: log "enrollment: pending" (the terminal watches for it)
    loop while pending: status every 15 s, heartbeat every 20 s
        puppet->>api: GET /devices/me (Bearer token)
        api-->>puppet: 200 {status: pending}
        puppet->>api: POST /devices/:id/heartbeat {status: ok}
    end
    admin->>api: POST /devices/:id/approve {name, location, organizationId}
    puppet->>api: GET /devices/me
    api-->>puppet: 200 {status: active, organizationId, name}
    Note over puppet: phase = Active<br/>fetch Commands once, refresh the feed,<br/>connect to the Wake-up broker
```

## Heartbeat and logs

Errors since the last heartbeat travel inside it; every log line is then shipped through the logs endpoint. The answer also says whether Commands are waiting.

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
    participant agent as Agent loop
    participant queue as Log queue (16 entries)
    participant api as Puppeteer

    agent->>queue: agentLog(error, "refreshing the event feed failed: HTTP 500")
    Note right of queue: also printed to stderr for journald.<br/>Full queue drops the oldest line.<br/>Broker lines never make the heartbeat degraded
    agent->>queue: collect error entries
    agent->>api: POST /devices/:id/heartbeat {status: degraded, errors: [...]}
    alt heartbeat accepted
        api-->>agent: 200 {success: true, commandsWaiting}
        Note over agent: commandsWaiting = true makes a Command fetch due.<br/>A missing or non-boolean value is a decoding error:<br/>logged, heartbeat counted as failed
        loop each queued line, oldest first
            agent->>api: POST /devices/:id/logs {level, message}
            api-->>agent: 200
            agent->>queue: pop
        end
    else 401 Unauthorized
        api-->>agent: 401
        Note over agent: credentials revoked, enroll again
    else network or server error
        api-->>agent: curl error / 5xx
        Note over agent,queue: lines stay queued for the next heartbeat
    end
```

## Revoked credentials

Recorded during end-to-end testing against a Puppeteer restarted with an empty database.

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
    participant puppet as Puppet
    participant store as MMKV
    participant api as Puppeteer (fresh database)

    puppet->>store: loadCredentials()
    store-->>puppet: device 7164e650, token
    puppet->>api: GET /devices/me (Bearer old token)
    api-->>puppet: 401 Unauthorized
    puppet->>store: clearCredentials() + sync
    Note over puppet: phase = Unenrolled, connect due now
    puppet->>api: POST /devices/connect {identifier: e2e-kiosk-1}
    api-->>puppet: 200 {device: 90841d40, token}
    puppet->>store: saveCredentials()
    Note over puppet,api: Device is back in the pending queue
```

## Command lifecycle

The Puppet acknowledges a Command before executing it and reports the outcome afterwards. Today `update` is reported as succeeded as soon as the new binary is installed, before it restarts into it (issue #46 proposes reporting it only once the new binary is confirmed).

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
    participant api as Puppeteer
    participant puppet as Puppet
    participant host as Host OS
    participant trail as Audit Trail

    admin->>api: POST /organizations/:org/devices/:id/commands {type: restart}
    Note over api: status = pending, then a Wake-up is published
    api-->>puppet: Wake-up (or commandsWaiting on the next heartbeat)
    puppet->>api: GET /devices/:id/commands/pending
    api-->>puppet: [{id, type: restart}] and status = sent
    puppet->>api: POST /devices/:id/commands/:cid/ack
    Note over api: status = acknowledged, redelivery stops
    puppet->>trail: record "reboot" before triggering it
    puppet->>host: systemctl reboot --no-block
    host-->>puppet: exit 0 (job queued)
    puppet->>trail: record the Command and its result
    puppet->>api: POST /devices/:id/commands/:cid/complete {success: true}
    Note over api: status = completed
    host->>puppet: SIGTERM, then reboot
```

## Command status on Puppeteer

Delivery is at-least-once: anything not acknowledged is returned again by the next fetch.

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
    [*] --> pending : Admin issues Command
    pending --> sent : fetched with GET .../commands/pending
    sent --> sent : not acked, redelivered on the next fetch
    sent --> acknowledged : POST .../ack
    acknowledged --> completed : complete {success: true}
    acknowledged --> failed : complete {success: false}
    completed --> [*]
    failed --> [*]
    note right of sent
        at-least-once delivery:
        lost response or crash before ack
        means the Command comes back
    end note
```

## Command dispatch

How each Command type is handled. Unsupported types are reported as failed with a warning log.

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
    command[/"Command from batch"/] --> ack["POST ack"]:::shell
    ack --> type{"type"}
    type -->|request_telemetry| telemetry["StatsI.getSnapshot()<br/>POST /telemetry"]:::core
    type -->|update| update["agentUpdate()<br/>download, verify, install"]:::core
    type -->|restart| reboot["record reboot,<br/>systemctl reboot --no-block"]:::shell
    type -->|shutdown| poweroff["record poweroff,<br/>systemctl poweroff --no-block"]:::shell
    type -->|open_ssh, custom, unknown| unsupported["Unsupported<br/>warning log"]:::danger
    telemetry --> complete["POST complete {success}"]:::shell
    update --> complete
    reboot --> complete
    poweroff --> complete
    unsupported --> complete
    complete -.-> audit[("Audit Trail:<br/>every executed Command<br/>with its result")]:::store
    complete --> next{"Restart<br/>requested?"}
    next -->|no| more([Next Command in batch])
    next -->|yes| leave(["Leave the rest unacked,<br/>redelivered to the new binary"]):::ok
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Data model

Server-side records touched by the device protocol, and what the Puppet keeps locally: the MMKV entries and the Audit Trail.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
erDiagram
    ORGANIZATION ||--o{ DEVICE : owns
    DEVICE ||--o{ COMMAND : receives
    DEVICE ||--o{ TELEMETRY_HEARTBEAT : sends
    DEVICE ||--o{ TELEMETRY_LOG : sends
    DEVICE ||--o| TELEMETRY_DATA : "latest detailed"
    DEVICE ||--|| MMKV_ENTRY : "mirrored on device by"
    DEVICE ||--o{ AUDIT_ENTRY : "recorded on the Device in"

    DEVICE {
        text id PK
        text identifier "machine id, reused while pending"
        text status "pending active offline rejected"
        text organizationId FK
        text tokenHash "sha256 of Bearer token"
    }
    COMMAND {
        text id PK
        text deviceId FK
        text type "restart shutdown update ..."
        jsonb payload "update: url sha256 version"
        text status "pending sent acknowledged completed failed"
    }
    TELEMETRY_HEARTBEAT {
        text deviceId FK
        timestamp timestamp
        text status "ok or degraded"
        jsonb errors
    }
    TELEMETRY_LOG {
        text id PK
        text level
        text message
    }
    TELEMETRY_DATA {
        text deviceId PK
        jsonb data "cpuTemp memoryUsage diskUsage ..."
    }
    MMKV_ENTRY {
        string device_id "device.id"
        string device_token "device.token"
        string feed_events "feed.events raw JSON"
    }
    AUDIT_ENTRY {
        string when "UTC timestamp"
        string who "agent, command or user"
        string what "binary, unit, enrollment ..."
        string before
        string after
    }
```

## JSON token layout

The tokenizer writes a flat array of tokens in document order. Objects count their keys, each key has its value as single child, and lookups skip whole subtrees.

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
    text[/"{&quot;device&quot;:{&quot;id&quot;:&quot;abc&quot;},&quot;token&quot;:&quot;xyz&quot;}"/]:::external
    text -.->|"JsonI.parse()"| t0
    t0["#0 OBJECT<br/>childCount 2"]:::core
    t1["#1 STRING device<br/>childCount 1"]:::shell
    t2["#2 OBJECT<br/>childCount 1"]:::core
    t3["#3 STRING id<br/>childCount 1"]:::shell
    t4["#4 STRING abc"]:::store
    t5["#5 STRING token<br/>childCount 1"]:::shell
    t6["#6 STRING xyz"]:::store
    t0 -->|key| t1
    t0 -->|key| t5
    t1 -->|value| t2
    t2 -->|key| t3
    t3 -->|value| t4
    t5 -->|value| t6
    note["Stored flat in document order #0..#6.<br/>findMember(#0, token) skips the subtree #1..#4"]:::external
    t6 ~~~ note
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```
