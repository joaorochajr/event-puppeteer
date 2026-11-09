# Event Puppeteer

Puppeteer serves as the central hub managing organizations, devices, events, and users for institutional kiosk displays.

## Language

**Puppeteer**:
The server application (API) that manages the core domain logic, devices, and events.
_Avoid_: Backend, API server

**Puppet**:
The C application running on physical kiosk devices. It installs itself, enrolls with Puppeteer, keeps the event feed current and obeys Commands. Showing the feed on screen is not implemented yet; the web TV mode of puppet-show covers it meanwhile.
_Avoid_: Device app, Kiosk software

**Device**:
A physical kiosk machine running the Puppet. It belongs to an Organization once approved.
_Avoid_: Terminal, screen, display, node

**Organization**:
The multi-tenancy boundary that groups Users, Devices and Events.
_Avoid_: Tenant, company, institution

**Event**:
An institutional occasion published by a User within an Organization, shown in the Public Feed and on Devices.
_Avoid_: Activity, session, post

**Command**:
An instruction an Admin sends from Puppeteer to a Device (restart, shutdown, update, request telemetry).
_Avoid_: Action, instruction, directive

**Wake-up**:
The empty one-way notice Puppeteer publishes so a Device fetches its waiting Command at once. A missed Wake-up delays a Command but never loses it.
_Avoid_: Push, notification, signal, doorbell

**puppet-show**:
The frontend web application where users browse events and administrators manage the system.
_Avoid_: Web UI, Frontend

**Unified Dashboard**:
The private application area (`/dashboard`) that progressively discloses management tools based on the user's role (Member, Moderator, Admin, Superadmin).
_Avoid_: Member panel, Admin panel, Backoffice

**Context Switcher**:
The dropdown in the Unified Dashboard that allows Superadmins to switch between managing the global system and acting as an Admin within a specific organization.
_Avoid_: Organization selector, tenant picker

**Public Feed**:
The main discovery area in puppet-show (`/`, "Mural" in the interface) displaying all non-hidden events for an organization.
_Avoid_: Event list, Homepage

**Shadow Ban**:
A moderation state where a user's content is invisible to others but remains visible to the creator. Triggered automatically by a report threshold or by a Confirmed Rejection of one of the user's Images.
_Avoid_: Ghost ban, Silent ban, Soft ban, Mute

## More vocabulary

The terms above are shared by every app. The rest of each app's language (Roles, Day Entry, Tag, Image, Screening, Enrollment, Installation, Heartbeat, Rollback and others) lives in the `CONTEXT.md` of the app that owns it, listed in [CONTEXT-MAP.md](CONTEXT-MAP.md).
