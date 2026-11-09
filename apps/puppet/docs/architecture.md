# Architecture

How Puppet fits into the Event Puppeteer platform, how it is installed and deployed, and how its C modules are organized around a functional core and an imperative shell.

## Contents

- [System context](#system-context)
- [What runs on a Device](#what-runs-on-a-device)
- [Deployment](#deployment)
- [Module dependencies](#module-dependencies)
- [Module interfaces](#module-interfaces)
- [Configuration resolution](#configuration-resolution)
- [Telemetry mapping](#telemetry-mapping)
- [Build pipeline](#build-pipeline)

## System context

Puppet is the agent running on every kiosk Device. It talks to Puppeteer over HTTPS and listens to a public MQTT broker for Wake-ups, empty notices that make it fetch a waiting Command at once. Admins act on Devices through puppet-show, never directly. A technician puts the binary on the Device and runs it once. Displaying the feed on screen is not implemented yet.

```mermaid
C4Context
    title System Context — Puppet in the Event Puppeteer platform

    Person(admin, "Admin / Superadmin", "Approves Devices, sends Commands")
    Person(technician, "Technician", "Copies the binary to a Device and runs it")
    System_Ext(puppetShow, "puppet-show", "Web app: Unified Dashboard")
    System(puppet, "Puppet", "C agent on each kiosk Device")
    System_Ext(puppeteer, "Puppeteer", "Central API: Devices, Events, Commands")
    System_Ext(broker, "Wake-up broker", "Public MQTT broker (HiveMQ)")

    Rel(admin, puppetShow, "Manages fleet in", "HTTPS")
    Rel(technician, puppet, "Installs and repairs", "./puppet")
    Rel(puppetShow, puppeteer, "Calls", "REST/JSON")
    Rel(puppet, puppeteer, "Device protocol", "HTTPS + Bearer")
    Rel(puppeteer, broker, "Publishes", "MQTT/TLS")
    Rel(puppet, broker, "Hears Wake-ups", "MQTT/TLS")

    UpdateRelStyle(admin, puppetShow, $textColor="#475569", $lineColor="#94a3b8", $offsetY="-10")
    UpdateRelStyle(technician, puppet, $textColor="#475569", $lineColor="#94a3b8", $offsetY="-10")
    UpdateRelStyle(puppetShow, puppeteer, $textColor="#475569", $lineColor="#94a3b8", $offsetX="-60", $offsetY="30")
    UpdateRelStyle(puppet, puppeteer, $textColor="#475569", $lineColor="#60a5fa", $offsetX="-90", $offsetY="-25")
    UpdateRelStyle(puppeteer, broker, $textColor="#475569", $lineColor="#f59e0b", $offsetY="10")
    UpdateRelStyle(puppet, broker, $textColor="#475569", $lineColor="#f59e0b", $offsetX="-20", $offsetY="-25")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

## What runs on a Device

A single `puppet` binary installed at `/opt/dsrs-puppet/puppet`, started by systemd as root. Its data directory holds the MMKV store and the append-only Audit Trail; systemd also executes the power Commands.

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
    subgraph device["Kiosk Device — Debian, systemd"]
        direction TB
        systemd["systemd<br/>dsrs-puppet.service"]:::shell
        agent["puppet<br/>/opt/dsrs-puppet/puppet<br/>Enrollment, heartbeats, Commands, feed"]:::core
        mmkv[("MMKV store<br/>/var/lib/dsrs-puppet<br/>device.id, device.token, feed.events")]:::store
        trail[("Device Audit Trail<br/>audit-trail.jsonl<br/>append-only")]:::store
        systemd -->|"starts at boot,<br/>restarts on failure"| agent
        agent -->|"systemctl reboot / poweroff<br/>--no-block"| systemd
        agent -->|"credentials and feed"| mmkv
        agent -->|"appends every change"| trail
    end
    puppeteer["Puppeteer API<br/>Elysia + Postgres"]:::external
    broker["Wake-up broker<br/>public MQTT"]:::external
    agent <-->|"Device protocol<br/>HTTPS + Bearer"| puppeteer
    broker -->|"empty Wake-up<br/>MQTT over TLS"| agent
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Deployment

Kiosks run Debian (ARM32 builds target bullseye) under a systemd service; Puppeteer runs on Vercel backed by PostgreSQL. The broker is a public one, so it is outside both.

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
    subgraph kiosk["Kiosk Device — Debian armhf, systemd"]
        direction TB
        subgraph unit["dsrs-puppet.service — Restart=always, runs as root"]
            puppetBinary["puppet<br/>agent loop"]:::core
        end
        dataDir[("/var/lib/dsrs-puppet<br/>MMKV, Audit Trail")]:::store
        puppetBinary -->|"mmap reads and writes"| dataDir
    end
    subgraph cloud["Vercel (gru1, Hobby plan)"]
        api["Puppeteer<br/>Elysia API<br/>Wake-up publisher"]:::shell
    end
    db[("PostgreSQL<br/>Devices, Commands, telemetry")]:::store
    subgraph hive["HiveMQ public broker — mqtts :8883"]
        brokerService["MQTT broker<br/>relays empty Wake-ups"]:::external
    end
    puppetBinary <-->|"Device protocol<br/>HTTPS"| api
    api -->|"SQL"| db
    api -->|"publishes Wake-ups"| brokerService
    brokerService -->|"Wake-ups"| puppetBinary
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Module dependencies

Pure modules (blue) hold every decision and are unit-tested without network, clock, filesystem or root. Shell modules (amber) perform IO and stay thin.

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
    subgraph shell["Imperative shell — IO"]
        direction TB
        main["main.c"]:::shell
        installer["installer<br/>+ watcher"]:::shell
        agent["agent"]:::shell
        wakeup["wakeup<br/>(libmosquitto)"]:::shell
        httpClient["http-client<br/>(libcurl)"]:::shell
        deviceStore["device-store"]:::shell
        auditTrail["audit-trail"]:::shell
        agentLock["agent-lock"]:::shell
        lifecycle["lifecycle<br/>(signalfd, clocks)"]:::shell
        executor["command-executor<br/>(systemd)"]:::shell
        selfUpdate["self-update"]:::shell
    end
    subgraph core["Functional core — pure, unit-tested"]
        direction TB
        installation["installation<br/>+ watch"]:::core
        schedule["agent-schedule"]:::core
        protocol["protocol"]:::core
        config["config"]:::core
        json["json"]:::core
        sha256["sha256"]:::core
    end
    mmkv[("MMKV")]:::store

    main --> installer
    main --> agentLock
    main --> config
    main --> agent
    installer --> installation
    installer --> auditTrail
    installer --> selfUpdate
    agent --> schedule
    agent --> protocol
    agent --> httpClient
    agent --> wakeup
    agent --> deviceStore
    agent --> auditTrail
    agent --> executor
    agent --> selfUpdate
    agent --> lifecycle
    deviceStore --> mmkv
    protocol --> json
    selfUpdate --> sha256
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Module interfaces

Each module exposes a single `const struct <Type>Type <Type>I` of function pointers (see [coding standards](coding-standards.md)). The agent composes them.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
classDiagram
    direction LR
    class AgentScheduleType {
        <<interface>>
        +create(hasCredentials, now) AgentSchedule
        +dueTasks(schedule, now) AgentTaskSet
        +secondsUntilNextTask(schedule, now) uint64
        +connected(schedule, now) AgentSchedule
        +connectFailed(schedule, now, random) AgentSchedule
        +deviceStateReceived(schedule, state, now) AgentSchedule
        +credentialsRevoked(schedule, now) AgentSchedule
        +heartbeatAnswered(schedule, commandsWaiting, now) AgentSchedule
        +wakeupHeard(schedule, now) AgentSchedule
        +brokerSubscribed(schedule, now) AgentSchedule
        +brokerLost(schedule, now, random) AgentSchedule
        +brokerAction(schedule, now) AgentBrokerAction
        +taskFinished(schedule, task, succeeded, now) AgentSchedule
    }
    class AgentSchedule {
        +AgentPhase phase
        +uint64 nextConnectAt
        +uint64 nextStatusCheckAt
        +uint64 nextHeartbeatAt
        +uint64 nextCommandFetchAt
        +uint64 nextFeedRefreshAt
        +AgentBrokerState brokerState
        +uint32 brokerFailureCount
        +uint32 connectFailureCount
        +char organizationId[64]
    }
    class ProtocolType {
        <<interface>>
        +writeConnectRequest()
        +readConnectResponse()
        +readDeviceState()
        +writeHeartbeatRequest()
        +readHeartbeatAnswer()
        +writeLogRequest()
        +writeTelemetryRequest()
        +readCommandBatch()
        +writeCommandCompletion()
        +countFeedEvents()
        +readUpdateInstruction()
    }
    class Command {
        +char id[64]
        +CommandType type
        +char payload[1024]
    }
    class WakeupListenerType {
        <<interface>>
        +open(listener, settings, topic) code
        +retarget(listener, topic) code
        +serve(listener) code
        +takeEvents(listener) WakeupEvents
        +close(listener)
    }
    class SelfUpdateType {
        <<interface>>
        +resolvePaths(paths) code
        +checkCompatibility(candidate, running) code
        +install(paths, digest) code
        +discardStaged(paths)
        +restart(paths, argv)
    }
    class AuditTrailType {
        <<interface>>
        +record(path, actor, what, before, after) code
        +readLatestAfter(path, what) code
    }
    class AgentType {
        <<interface>>
        +run(environment) AgentExitReason
    }
    AgentType ..> AgentScheduleType : decides with
    AgentType ..> ProtocolType : encodes / decodes with
    AgentType ..> WakeupListenerType : hears Wake-ups with
    AgentType ..> SelfUpdateType : installs with
    AgentType ..> AuditTrailType : records changes with
    AgentScheduleType --> AgentSchedule : returns new
    ProtocolType --> Command : fills CommandBatch
```

## Configuration resolution

Puppet reads no environment variable for configuration (ADR-0001). Puppeteer's URL and the broker are chosen when building; paths are constants; the Device identifier is always `/etc/machine-id`. Every failure path has its own error code (3001–3003, 3007–3008).

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
    subgraph build["At build time (CMake)"]
        url{"PUPPET_SERVER_URL given?"} -->|no| cfgFail["Configuring fails"]:::danger
        url -->|yes| shape{"http:// or https:// URL?"} -->|no| cfgFail
        shape -->|yes| baked["Baked into the binary"]:::ok
        brokerOptions["PUPPET_WAKEUP_BROKER_HOST / _PORT / _TLS<br/>broker.hivemq.com, 8883, ON"]:::core --> baked
    end
    subgraph start["At start (config.c)"]
        urlText{"Baked URL empty?"} -->|yes| e3001["3001 missing"]:::danger
        urlText -->|no| scheme{"http:// or https://?"} -->|no| e3002["3002 invalid"]:::danger
        scheme -->|yes| length{"Fits 256 bytes?"} -->|no| e3003["3003 too long"]:::danger
        length -->|yes| trim["Strip trailing /"]:::ok
        machine{"/etc/machine-id<br/>present and not empty?"} -->|no| e3007["3007 missing"]:::danger
        machine -->|yes| idLength{"Fits 128 bytes?"} -->|no| e3008["3008 too long"]:::danger
        idLength -->|yes| identity["Device identifier"]:::ok
    end
    baked --> urlText
    paths["Paths are constants:<br/>/opt/dsrs-puppet, /var/lib/dsrs-puppet,<br/>/run/dsrs-puppet.lock"]:::shell
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Telemetry mapping

How the `stats` snapshot becomes the `DeviceTelemetry` JSON answered to a `request_telemetry` Command. Empty strings are omitted so they never overwrite a previous report.

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
    subgraph snapshot["StatsSnapshot (stats.c)"]
        direction TB
        temp["cpuTemperature"]:::core
        used["usedSystemMemory"]:::core
        storage["storageTotal / storageUsed"]:::core
        rss["appMemoryUsage"]:::core
        uptime["uptime"]:::core
        os["osName + osVersion"]:::core
        ip["ip"]:::core
    end
    subgraph json["DeviceTelemetry JSON"]
        direction TB
        cpuTemp["cpuTemp"]:::store
        memoryUsage["memoryUsage (bytes)"]:::store
        disk["diskTotal / diskUsage"]:::store
        puppetMemory["puppetMemoryUsage"]:::store
        uptimeOut["uptime"]:::store
        osVersion["osVersion"]:::store
        network["networkInfo"]:::store
    end
    temp --> cpuTemp
    used --> memoryUsage
    storage --> disk
    rss --> puppetMemory
    uptime --> uptimeOut
    os --> osVersion
    ip --> network
    build[/"PUPPET_VERSION, start time"/]:::shell --> extras["puppetVersion, puppetStartTime"]:::store
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Build pipeline

Native builds run the unit tests. ARM32 cross builds fetch a Debian sysroot, re-fetched automatically whenever the setup script changes. libmosquitto is built from source and linked statically, so a Device needs only the libcurl runtime.

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
    src[("apps/puppet/src")]:::store --> native["cmake -B build<br/>-DPUPPET_SERVER_URL=..."]:::core
    src --> cross["cmake -B build-linux-arm32<br/>toolchains/arm32-linux.cmake"]:::core
    native --> fetch["FetchContent<br/>MMKV v2.4.2, libmosquitto v2.0.11 (static)"]:::shell
    cross --> fetch
    cross --> stamp{"sysroot stamp ==<br/>sha256(setup script)?"}
    stamp -->|no| setup["setup-arm32-sysroot.sh<br/>Debian bullseye armhf .debs<br/>libc, libstdc++, libcurl, OpenSSL headers..."]:::shell
    setup --> writeStamp["write .setup-script.sha256"]:::shell
    writeStamp --> armBuild
    stamp -->|yes| armBuild["arm-linux-gnu-gcc -Werror<br/>+ MMKV (C++17) + libcurl + libmosquitto"]:::core
    fetch --> nativeBuild["gcc -Werror<br/>+ MMKV + libcurl + libmosquitto"]:::core
    native --> nativeBuild
    nativeBuild --> tests["puppet-tests<br/>ctest"]:::ok
    armBuild --> armBinary(["puppet: ELF 32-bit ARM EABI5"]):::ok
    nativeBuild --> nativeBinary(["puppet: x86-64"]):::ok
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```
