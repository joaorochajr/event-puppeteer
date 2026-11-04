# Puppeteer

The server (API) of the Event Puppeteer system. It is the single source of truth for Organizations, Users, Events, moderation, Devices and Images. Both clients talk to it over HTTP: [`puppet-show`](../puppet-show) (the web front end) and [`puppet`](../puppet) (the C agent on each kiosk Device).

The vocabulary (Organization, Device, Command, Wake-up, Shadow Ban, Image, Screening and others) is defined in [CONTEXT.md](CONTEXT.md) and in the [root glossary](../../CONTEXT.md). Use those terms in code, docs and issues.

## Stack

TypeScript 7 on [nub](https://www.npmjs.com/package/nub), [Elysia](https://elysiajs.com) (Node adapter locally, Vercel's Elysia runtime in production), Drizzle ORM over PostgreSQL, [better-auth](https://www.better-auth.com) for Users, `sharp` and `thumbhash` for Images, `mqtt` for Wake-ups. Tests run on the Node.js test runner with PGlite (an in-process Postgres), so they need no database or external service.

## Getting started

```bash
nub install                      # from the repository root
cp .env.example .env             # then fill it in (table below)
nub run db:migrate               # applies src/db/migrations
nub run db:seed:superadmin       # creates the first Superadmin
nub run start                    # http://localhost:$PORT (3000 by default)
```

The interactive API docs are served at `GET /openapi` (Scalar) and the raw spec at `GET /openapi/json`. Docs are generated from each route's `body`/`params`/`query`/`response` schemas. When adding a route, also give it a `detail` with `tags`, a `summary`, and `security` (`asUser` or `asDevice`, defined in `src/server.ts`) when it requires a token.

### Environment variables

Validated at startup by `src/env.ts`: the server refuses to start when a required one is missing or invalid. [`.env.example`](.env.example) lists them all with comments.

| Variable | Required | What for |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection used by the server. |
| `MIGRATION_DATABASE_URL` | no | Connection used by `db:migrate` instead of `DATABASE_URL`. On Supabase, use the Session pooler or the direct connection (port 5432). |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | yes | better-auth secret (10+ characters) and the URL it is served at. |
| `APP_URL` | no (`http://localhost:3000`) | Public URL of puppet-show: where the verification and password-reset links land. |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | in production | Transactional email through Brevo. Outside production, without a key, emails are printed to the console. `EMAIL_FROM` is required together with the key. |
| `SIGHTENGINE_API_USER`, `SIGHTENGINE_API_SECRET`, `OPENAI_API_KEY` | yes | Image Screening (ADR 0003). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes | Image storage. |
| `BLOB_READ_WRITE_TOKEN` | yes | Private Vercel Blob store for Puppet update binaries. |
| `PORT`, `NODE_ENV` | no (`3000`, `development`) | Local server. |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | only for the seed | Read by `db:seed:superadmin`, never by the server. |

The Wake-up broker is not configurable by environment: `WAKEUP_BROKER_URL` in `src/io/wakeup/mqtt.ts` is a constant (`mqtts://broker.hivemq.com:8883`). A Puppet built with another `PUPPET_WAKEUP_BROKER_*` must be matched here, or it will never hear a Wake-up (the heartbeat still delivers its Commands).

### Scripts

- `nub run start`: starts the server locally (`main.ts`).
- `nub run test`: runs the test suite with the Node.js test runner.
- `nub run db:migrate`: applies pending migrations using `MIGRATION_DATABASE_URL` (or `DATABASE_URL`) from `.env`.
- `nub run db:seed:superadmin`: creates the first Superadmin (or promotes an existing user) from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`. Idempotent. Registration only creates Members, so this is how the first Superadmin is bootstrapped. The account is created already verified.
- `nub run screen:image <file> --kind banner|logo [--crop] [--ignore-size] [--policy 30,80] [--raw]`: screens one picture with the real Sightengine and OpenAI engines and prints each engine's scores, the combined ones and the verdict under `--policy` (review,reject in percent). Writes nothing (no database, no Cloudinary). `--crop` crops the largest centred area of the kind's proportion first; `--ignore-size` skips the proportion, minimum-size and 4 MB checks (screening only; the app still refuses such pictures) and, without `--crop`, keeps the whole picture, only scaled down to fit the kind's maximum; `--raw` prints the engines' JSON answers. Needs the three Screening keys; each picture spends about 4 Sightengine operations (`--raw` shows `request.operations`).

## Architecture: Functional Core / Imperative Shell

Handlers hold the rules and have no hidden side effects. The HTTP layer assembles the real IO and injects it.

1. **IO interfaces** live in `src/io/index.ts`: every side effect (database, email, image store, Screening engines, update-binary store, Wake-up publisher) is an interface.
2. **Handlers** (`src/handlers/*.ts`) take `(request, ..., io)` and return the response. Example: `export async function myHandler(request: Request, io: AppIO) { ... }`.
3. **Real implementations** sit next to their interface (`src/io/drizzle`, `email`, `image-store`, `screening`, `update-binary-store`, `wakeup`) and are assembled by `createRealIO`.
4. **In-memory implementations** (`src/io/in-memory.ts` and the `in-memory.ts` of each IO) exist for tests only.
5. **The shell** is `src/server.ts`, which maps routes to handlers and errors to HTTP statuses.
6. **Tests** call handlers directly with the in-memory IO and assert the response and the state of the in-memory stores. No HTTP server is started for them (`src/server.test.ts` is the exception: it checks the routes themselves).

### Source layout

| Path | What is in it |
|---|---|
| `main.ts` | Local entry (`nub run start`): checks the port, serves, shuts down on `SIGINT`/`SIGTERM`. |
| `src/index.ts` | Vercel entry: default-exports the app, keeping the Wake-up connection alive with `waitUntil`. |
| `src/server.ts` | Routes, OpenAPI details, error mapping. |
| `src/handlers/` | The rules, one file per area (`auth`, `users`, `organization`, `events`, `feed`, `votes`, `moderation`, `images`, `devices`, `telemetry`, `system`, `health`, `seed`). |
| `src/io/` | IO interfaces and their implementations. |
| `src/types/` | TypeBox schemas, also the source of the OpenAPI spec. puppet-show checks its hand-kept copy against them (`apps/puppet-show/contract`). |
| `src/db/` | Drizzle schema, migrations and the PGlite database used by tests. |
| `src/images/` | Image preparation (`sharp`) and the Screening verdict. |
| `src/emails/` | Verification and password-reset emails. |
| `src/scripts/` | `migrate`, `seed-superadmin`, `screen-image`. |

## Access rules

- Public: `GET /health`, the docs, `POST /auth/register`, `POST /auth/login`, `POST /devices/connect`, and the read routes behind public screens: event list/feed/details, `GET /organizations/:id` (TV branding), `GET /tags`, `GET /link-labels`. Everything else requires a token; `src/server.test.ts` fails if a route is exposed by mistake.
- Users send a Bearer session token (`userToken`); Devices send the Bearer token issued at enrollment (`deviceToken`, stored only as a SHA-256 hash).
- A Superadmin has no Organization; every other User has exactly one. `User` is a union discriminated by `role`, and the database enforces the same rule (`user_role_organization` check).

### Routes by area

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `/auth/*`: register, login, `me`, email verification, password reset |
| Organizations | `/organizations`, `/organizations/:id`, `/:id/feed`, `/:id/logo`, `/:id/users`, `/:id/reports`, `/:id/shadow-bans`, `/:id/audit`, `/:id/image-reviews` |
| Events | `/organizations/:id/events`, `/:eventId`, `/mine`, `/:eventId/banner`, `/vote`, `/report`, `/hide`, `/unhide` |
| Catalog | `/tags` (and `/:tagId/promote`), `/link-labels` |
| Images | `/image-reviews/escalated`, `/image-reviews/:imageId/approve\|reject`, `/screening-policy` |
| Devices (Device token) | `/devices/connect`, `/me`, `/:deviceId/heartbeat`, `/logs`, `/telemetry`, `/commands/pending`, `/commands/:commandId/ack\|complete`, `/commands/:commandId/binary` |
| Devices (Users) | `/devices/pending`, `/devices/:deviceId/approve\|reject`, `/organizations/:id/devices` (list, pending, status, logs, telemetry, `telemetry/request`, commands, `commands/:commandId/wakeup`, `update-uploads`) |

The OpenAPI spec is the complete and current reference.

## Devices, Commands and Wake-ups

- **Enrollment** (ADR 0002): `POST /devices/connect` creates a `pending` Device and answers a token. The Superadmin approves it into any Organization; an Admin approves it only into their own, when the Device named no other. Approving gives it a name and location, and only an `active` Device is handed Commands.
- **Heartbeat**: `POST /devices/:id/heartbeat` records liveness and recent errors. The Puppet sends one every 20 s. A Device is online when its last heartbeat is under 60 s old.
- **Commands** (`restart`, `shutdown`, `update`, `open_ssh`, `custom`, `request_telemetry`) are issued by Admins. Status goes `pending` → `sent` (handed to the Device, and redelivered until it acknowledges: delivery is at-least-once) → `acknowledged` → `completed` or `failed`. The Puppet runs `restart`, `shutdown`, `update` and `request_telemetry`; the others are reported back as failed.
- **Wake-up** (root ADR 0001): storing a Command publishes an empty message on the public MQTT broker, topic `<deviceId>/<organizationId>` (QoS 1, not retained), and the answer reports the outcome in `wakeup` (`{ sent: true }` or `{ sent: false, reason }`). A failed Wake-up never fails the request: the Device gets the Command on its next heartbeat. An Admin can resend it while the Command is `pending` or `sent`. The publisher keeps one broker connection per function instance, warmed on every request.
- **`commandsWaiting`**: every heartbeat answer says whether the Device has a `pending` or `sent` Command. It is how the Puppet reconciles a missed Wake-up, and the reason it no longer polls Commands.
- **Update binaries**: sent from the dashboard to a **private** Vercel Blob store. The browser uploads straight to it with a one-upload credential from `POST /organizations/:id/devices/update-uploads` (up to 64 MiB). An `update` Command then carries `{ blobPathname, sha256, version? }`, and the Device pulls `{ url, sha256, version? }` where `url` is a short path (`/devices/:id/commands/:commandId/binary`, because Puppet keeps the address in 512 bytes) that answers 302 to a URL signed for ten minutes at download time. If the store cannot sign, the download fails with 502. An `update` can also carry an absolute `http(s)` URL.

## Email verification and password reset

New accounts must confirm their email before logging in (`POST /auth/login` answers 403 until then). Registration sends a link to `GET /auth/verify-email`, which marks the email as verified and redirects to `$APP_URL/login?emailVerified=1` (or `0` for an invalid or expired link). `POST /auth/resend-verification` sends a new link. Emails go through Brevo; without a key outside production they are printed to the console.

Forgotten passwords: `POST /auth/request-password-reset` (always answers success, so it does not reveal accounts) emails a link to `$APP_URL/redefinir-senha?token=…`, valid for 60 minutes. `POST /auth/reset-password` with that token and the new password sets it once and ends every session of the account. Removed accounts never get a link and cannot log in again through one.

## Images (banners and logos)

Event banners (16:9, at least 960×540) and Organization logos (1:1, at least 256×256) are uploaded as multipart `file` to `PUT /organizations/:id/events/:eventId/banner` and `PUT /organizations/:id/logo`, never set as URLs. Each upload is normalized with `sharp` (EXIF orientation applied, metadata stripped, re-encoded as WebP, scaled down to 1920×1080 or 512×512 when larger), screened, given a thumbhash (the Placeholder), and stored in Cloudinary as an `authenticated` asset. A User may upload at most 10 Images per day. See [CONTEXT.md](CONTEXT.md) for the vocabulary and ADRs 0003 and 0004 for the decisions.

- Screening combines Sightengine and OpenAI omni-moderation (the most severe score wins) against the Screening Policy (`GET`/`PUT /screening-policy`, Superadmin). Until a policy is set, and whenever Screening fails, Images wait in Image Review.
- Image Review: `GET /organizations/:id/image-reviews` (Moderator+), `GET /image-reviews/escalated` (Superadmin), `POST /image-reviews/:imageId/approve|reject`. Nobody reviews their own Image; a rejection there shadow-bans the uploader.
- Responses carry `banner`/`logo` as `{ url?, thumbhash }` resolved per viewer: the uploader always sees their latest Image through an expiring signed URL; everyone else sees the latest Approved Image, or only the thumbhash.

## Deployment

Puppeteer runs on Vercel (Hobby), pinned to `gru1` in `vercel.json`. Vercel serves `src/index.ts`; `main.ts` is only for local use. Set every required variable above in the project, run `db:migrate` against the production database, then `db:seed:superadmin` once. Note that Vercel's invocation allowance bounds how many Devices can heartbeat (about 181,000 requests per Device per month at a 20 s heartbeat, see the root ADR 0001).

## Tests

```bash
nub run test
```

In-memory IO, PGlite and an in-process MQTT broker (`aedes`): no server, database or external service is needed. The Screening engines, Cloudinary and Brevo are tested with answers shaped as their docs describe, never against the real services. Use `screen:image` to try the real engines.

## Decisions

- Per-app ADRs: [docs/adr](docs/adr): classic Shadow Ban with an automatic threshold (0001), auto-discovery Device enrollment (0002), Image Screening through free external APIs (0003), only confirmed rejections shadow-ban (0004).
- System-wide ADR: [Wake-up over a public MQTT broker](../../docs/adr/0001-wake-up-over-public-mqtt-broker.md).

## Known gaps

Tracked in GitHub issues: handlers still `throw` domain errors instead of returning them as values (#12, #42), user removal is not atomic (#13), and moderation and catalog gaps (#11).
