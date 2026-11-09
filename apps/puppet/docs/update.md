# Self-update

The `update` Command replaces the Puppet binary in place. Payload: `{"url": "...", "sha256": "<64 hex>", "version": "..."}`. When an admin uploads the binary from the dashboard, the `url` is a short path on Puppeteer (a signed Blob URL does not fit the 512-byte address buffer). Puppet sends its device token there and Puppeteer answers 302 to a Blob URL signed for ten minutes; libcurl drops the `Authorization` header when following a redirect to another host.

The Installation never replaces a valid installed binary: **only self-update changes it**, so every binary a Device runs got there through a verified `update` (or the first Installation), and the Audit Trail's latest `binary` entry always describes what is installed.

## Contents

- [End to end](#end-to-end)
- [Where the binary comes from](#where-the-binary-comes-from)
- [Verification](#verification)
- [Staged file lifecycle](#staged-file-lifecycle)
- [ELF header check](#elf-header-check)
- [SHA-256 padding](#sha-256-padding)
- [Command risk](#command-risk)
- [Planned: confirmation and Rollback](#planned-confirmation-and-rollback)

## End to end

The process keeps its PID: `execv` replaces the image, and the new binary resumes the stored enrollment. The agent lock survives the `execv`, so no second agent can start in between. Commands left in the same batch are redelivered to the new binary.

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
    participant puppet as Puppet (0.0.4)
    participant blob as Private Blob store
    participant fs as Filesystem
    participant trail as Audit Trail

    admin->>api: Command update {blobPathname, sha256, version: 0.0.5}
    api-->>puppet: Wake-up
    puppet->>api: GET /devices/:id/commands/pending
    api-->>puppet: [update {url: /devices/:id/commands/:cid/binary, sha256, version}]
    puppet->>api: POST .../ack
    puppet->>api: GET url (Bearer device token)
    api-->>puppet: 302 to a Blob URL signed for ten minutes
    puppet->>blob: GET signed URL (token not sent to another host)
    blob-->>puppet: binary stream (64 MiB cap)
    puppet->>fs: write puppet.update next to the executable
    puppet->>fs: SHA-256 of puppet.update
    puppet->>fs: compare ELF header with /proc/self/exe
    puppet->>fs: chmod 0755, fsync, rename over puppet, fsync dir
    puppet->>trail: record "binary" 0.0.4 to 0.0.5 sha256:...
    puppet->>api: POST .../complete {success: true}
    puppet->>puppet: flush logs, close broker, MMKV and curl, keep the agent lock
    puppet->>puppet: execv(puppet, argv) keeps the same PID
    Note over puppet: Puppet 0.0.5 started, resuming stored enrollment
    puppet->>api: GET /devices/me
```

## Where the binary comes from

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
    cmd[/"update Command payload"/] --> kind{"Where does the binary come from?"}
    kind -->|"uploaded from the dashboard"| stored["{ blobPathname, sha256, version? }<br/>Puppeteer rewrites it for the Device"]:::core
    stored --> path["url = /devices/:id/commands/:cid/binary<br/>(short: Puppet keeps it in 512 bytes)"]:::shell
    path --> own["Host is Puppeteer:<br/>the Device token is sent"]:::ok
    own --> signed["302 to a Blob URL signed for 10 min,<br/>libcurl drops Authorization on another host"]:::ok
    kind -->|"absolute URL"| direct["{ url: https://..., sha256, version? }"]:::core
    direct --> other["Any other host:<br/>the Device token is never sent"]:::danger
    signed --> download["Stream to executable.update<br/>(redirects followed, 64 MiB cap)"]:::shell
    other --> download
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Verification

Nothing is installed unless the digest matches and the ELF header targets the running architecture. Each rejection has its own code.

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
    payload[/"update payload"/] --> parse{"url and 64-hex sha256?"}
    parse -->|no| e2015["2015-2018 invalid payload"]:::danger
    parse -->|yes| download["Stream to executable.update"]:::shell
    download -->|"HTTP not 2xx / curl error"| discard["discardStaged()"]:::danger
    download -->|cannot open file| eFile["cannot write update"]:::danger
    download --> hash{"SHA-256 matches?"}
    hash -->|"staged file unreadable"| e4003["4003 staged file unreadable"]:::danger
    hash -->|no| e4004["4004 digest mismatch"]:::danger
    hash -->|yes| magic{"ELF magic?"}
    magic -->|no| e4005["4005 not an executable"]:::danger
    magic -->|yes| running{"/proc/self/exe readable?"}
    running -->|no| e4007["4007 running executable unreadable"]:::danger
    running -->|yes| arch{"Same class, byte order,<br/>version and e_machine?"}
    arch -->|no| e4006["4006 architecture mismatch"]:::danger
    arch -->|yes| install["chmod 0755, fsync,<br/>rename, fsync directory"]:::core
    install -->|"chmod or fsync fails"| e4008["4008 preparation failed"]:::danger
    install -->|rename fails| e4009["4009 replace failed"]:::danger
    install --> success(["complete success, execv"]):::ok
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
    classDef danger fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Staged file lifecycle

The download lives next to the executable so the final `rename` is atomic.

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
    [*] --> Absent
    Absent --> Downloading : download() opens executable.update
    Downloading --> Absent : transfer failed, discardStaged()
    Downloading --> Staged : HTTP 2xx, file closed
    Staged --> Absent : verification failed, unlink
    Staged --> Installed : rename over executable
    Installed --> Running : execv
    Running --> [*]
    note right of Installed
        rename is atomic on one filesystem:
        a power cut leaves the old or the new binary,
        never a partial one
    end note
```

## ELF header check

The first 20 bytes compared between the download and `/proc/self/exe`. `e_type` is ignored because PIE and non-PIE builds differ there.

```mermaid
%%{init: {'theme': 'base', 'packet': {'bitsPerRow': 20, 'bitWidth': 52, 'showBits': true}, 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
packet-beta
    title ELF header bytes compared before installing an update (one cell per byte)
    0-3: "magic 7F E L F"
    4: "class"
    5: "order"
    6: "version"
    7-15: "OS ABI and padding (ignored)"
    16-17: "e_type (ignored)"
    18-19: "e_machine"
```

## SHA-256 padding

The in-house SHA-256 (FIPS 180-4) pads the message as shown for `abc`. It is verified against NIST test vectors.

```mermaid
%%{init: {'theme': 'base', 'packet': {'bitsPerRow': 32, 'bitWidth': 40}, 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
packet-beta
    title SHA-256 final block for the message abc (64 bytes, one cell per byte)
    0-2: "a b c"
    3: "0x80"
    4-55: "zero padding"
    56-63: "length in bits = 24 (big endian)"
```

## Command risk

Why update and shutdown get the most safeguards. The positions are a judgment, not a measurement.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'quadrant1Fill': '#fee2e2', 'quadrant2Fill': '#fef3c7', 'quadrant3Fill': '#d1fae5', 'quadrant4Fill': '#e0e7ff', 'quadrantPointFill': '#4f46e5', 'quadrantTitleFill': '#1e293b', 'quadrant1TextFill': '#7f1d1d', 'quadrant2TextFill': '#78350f', 'quadrant3TextFill': '#064e3b', 'quadrant4TextFill': '#312e81', 'quadrantPointTextFill': '#1e293b', 'quadrantXAxisTextFill': '#334155', 'quadrantYAxisTextFill': '#334155',
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
quadrantChart
    title Commands by impact and reversibility
    x-axis "Easy to undo" --> "Hard to undo"
    y-axis "Low impact" --> "High impact"
    quadrant-1 "Guard carefully"
    quadrant-2 "Disruptive but recoverable"
    quadrant-3 "Safe"
    quadrant-4 "Quiet but sticky"
    request_telemetry: [0.08, 0.1]
    restart: [0.25, 0.6]
    update: [0.6, 0.85]
    shutdown: [0.85, 0.9]
    open_ssh: [0.4, 0.7]
    custom: [0.7, 0.3]
```

## Planned: confirmation and Rollback

A bad update cannot be undone today: the new binary replaces the old one and runs. The agreed vocabulary for an automatic Rollback (Confirmed binary, Last known good binary, Pending binary, Confirmation window) is in [CONTEXT.md](../CONTEXT.md); none of it is implemented yet.

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
    [*] --> PendingBinary : update installed, execv
    PendingBinary --> ConfirmedBinary : successful cycle with Puppeteer<br/>inside the Confirmation window
    PendingBinary --> Rollback : window expires or crashes
    Rollback --> LastKnownGood : run the Last known good binary
    ConfirmedBinary --> [*] : becomes the Last known good binary
    LastKnownGood --> [*]
    note right of PendingBinary
        PLANNED, not implemented.
        Today the new binary simply runs.
        Vocabulary: CONTEXT.md. The update Command
        reporting its outcome: issue #46
    end note
```
