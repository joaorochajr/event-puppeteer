# Puppet documentation

Diagrams are written in Mermaid inside the Markdown, so GitHub and most editors render them directly.

| Document | Covers |
|---|---|
| [Architecture](architecture.md) | System context, What runs on a Device, Deployment, Module dependencies, Module interfaces, Configuration resolution, Telemetry mapping, Build pipeline |
| [Installation](installation.md) | Two roles in one binary, What is checked, Elevation and repair, A fresh Installation, Watching the agent, Where things live, Only one agent, Device Audit Trail |
| [Agent loop and scheduling](agent.md) | Phases, Main loop, Cadence of an active Device, Request mix, Request volume by phase, Connect backoff, Termination without global state, Capabilities at a glance |
| [Wake-ups](wakeup.md) | Delivery, When Commands are fetched, Broker connection, Reconnect backoff, Outages, Settings and trust |
| [Device protocol](protocol.md) | Enrollment, Heartbeat and logs, Revoked credentials, Command lifecycle, Command status on Puppeteer, Command dispatch, Data model, JSON token layout |
| [Self-update](update.md) | End to end, Where the binary comes from, Verification, Staged file lifecycle, ELF header check, SHA-256 padding, Command risk, Planned confirmation and Rollback |
| [Project status](project.md) | Requirements traceability, Feature status, Deploying a kiosk, Development timeline |

See also the [coding standards](coding-standards.md), the [ADRs](adr) and the glossary in [CONTEXT.md](../CONTEXT.md).
