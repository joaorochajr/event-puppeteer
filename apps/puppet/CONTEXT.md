# Puppet

The C application on a kiosk Device. It installs itself, enrolls with Puppeteer, keeps the event feed and Telemetry current, and replaces its own binary when Puppeteer sends an `update` Command. The Device-side words shared with Puppeteer (Installation, Enrollment, Device Audit Trail, Wake-up, Command, Heartbeat) are defined in `../puppeteer/CONTEXT.md`.

## Language

### Processes

**Agent**:
The Puppet process systemd starts from the installed binary (`INVOCATION_ID` set): it holds the agent lock and talks to Puppeteer. There is at most one per Device. It names a role of the Puppet, not another program.
_Avoid_: Daemon, service (the service is what systemd runs; the agent is the process)

**Terminal**:
Any other run of the Puppet binary, started by a person. It installs or repairs the Installation, reports status and watches the Agent; it never becomes the Agent and never takes the agent lock.
_Avoid_: CLI, installer (the installer is one thing the terminal does)

### Update confirmation (planned)

Not implemented yet: the terms below are the agreed vocabulary for the automatic Rollback, which no code or ADR covers so far. Today an `update` installs the new binary and restarts into it with no confirmation (see issue #46 for how the `update` Command would report the outcome). Do not describe these as current behavior in the README.

**Confirmed binary**:
A Puppet binary that, after being installed by an update, completed its first successful cycle with Puppeteer within the confirmation deadline.
_Avoid_: Good binary, stable binary

**Last known good binary**:
The most recent Confirmed binary kept on the Device. An update that is not confirmed never replaces it, however many updates fail in a row.
_Avoid_: Backup, previous version

**Pending binary**:
A freshly installed update binary that is not yet a Confirmed binary. It stays pending, running, for as long as Puppeteer cannot be reached.
_Avoid_: Unverified binary, candidate

**Confirmation window**:
The 5 minutes, counted only while Puppeteer is reachable, in which a Pending binary must complete a successful cycle with Puppeteer. The same 5 minutes of stable running also reset the count of crashes against the Pending binary.
_Avoid_: Grace period, probation

**Rollback**:
Automatically running the Last known good binary again when an update is not confirmed.
_Avoid_: Revert, downgrade
