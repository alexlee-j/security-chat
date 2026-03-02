# Backend (NestJS)

## Run

```bash
cp apps/backend/.env.example apps/backend/.env
pnpm install
pnpm start:backend:dev
```

## Smoke (V1)

```bash
pnpm smoke:backend:v1
```

```bash
pnpm test:backend:e2e:v1
```

```bash
pnpm test:backend:ws:v1
```

Optional:

- `BASE_URL=http://127.0.0.1:3000/api/v1 pnpm smoke:backend:v1`
- `SMOKE_USER_PREFIX=ci pnpm smoke:backend:v1`
- `SMOKE_TIMEOUT_MS=15000 pnpm smoke:backend:v1`
- `SMOKE_KEEP_ARTIFACTS=1 pnpm smoke:backend:v1`
- `SMOKE_MEDIA_KIND=2 SMOKE_MESSAGE_TYPE=2 pnpm smoke:backend:v1`
- `SMOKE_BURN_DURATION=60 pnpm smoke:backend:v1`
- `SMOKE_MESSAGE_LIMIT=50 pnpm smoke:backend:v1`
- Script implementation: `apps/backend/scripts/v1-smoke.mjs` (Node runtime, no `jq/curl` dependency)
- E2E implementation: `apps/backend/scripts/v1-e2e.mjs` (covers positive and negative V1 assertions)
- WS E2E implementation: `apps/backend/scripts/v1-ws-e2e.mjs` (covers WS event chain consistency)

Supported smoke env vars:

- `BASE_URL`: API base url, default `http://127.0.0.1:3000/api/v1`
- `SMOKE_PASSWORD`: register/login password, default `Password123`
- `SMOKE_USER_PREFIX`: generated username prefix, default `smoke`
- `SMOKE_TIMEOUT_MS`: per-request timeout in ms, default `10000`
- `SMOKE_KEEP_ARTIFACTS`: set `1` to keep temp artifacts, default cleanup enabled
- `SMOKE_MEDIA_KIND`: uploaded media kind, one of `2|3|4`, default `4`
- `SMOKE_MESSAGE_TYPE`: message type to send, one of `2|3|4`, default follows `SMOKE_MEDIA_KIND`
- `SMOKE_BURN_DURATION`: burn duration for burn-flow check, one of `5|10|30|60|300`, default `30`
- `SMOKE_MESSAGE_LIMIT`: query limit for message list assertion, default `20`

## Health

- `GET /api/v1/health`

## Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout` (Bearer token required)

## User

- `GET /api/v1/user/:id`
- `POST /api/v1/user/keys/upload` (Bearer token required)
- `GET /api/v1/user/keys/device/:deviceId/next` (Bearer token required)
- `POST /api/v1/user/keys/device/:deviceId/next-consume` (Bearer token required, atomic consume)
- `POST /api/v1/user/keys/consume` (Bearer token required)

## Media

- `POST /api/v1/media/upload` (Bearer token required, multipart field: `file`, optional body: `mediaKind` in `[2,3,4]`)
- `POST /api/v1/media/:mediaAssetId/attach` (Bearer token required)
- `GET /api/v1/media/:mediaAssetId/meta` (Bearer token required)
- `GET /api/v1/media/:mediaAssetId/download` (Bearer token required)

## Friend

- `POST /api/v1/friend/request` (Bearer token required)
- `POST /api/v1/friend/respond` (Bearer token required)
- `GET /api/v1/friend/list` (Bearer token required)
- `GET /api/v1/friend/pending/incoming` (Bearer token required)
- `GET /api/v1/friend/search?keyword=alice&limit=20` (Bearer token required)
- `POST /api/v1/friend/block` (Bearer token required)
- `POST /api/v1/friend/unblock` (Bearer token required)
- `GET /api/v1/friend/blocked` (Bearer token required)

## Protected APIs

- `POST /api/v1/conversation/direct` (Bearer token required)
- `GET /api/v1/conversation/list?limit=50` (Bearer token required; includes `defaultBurnEnabled/defaultBurnDuration`)
- `GET /api/v1/conversation/:conversationId/burn-default` (Bearer token required)
- `POST /api/v1/conversation/:conversationId/burn-default` (Bearer token required)
- `POST /api/v1/message/send` (Bearer token required; for `messageType` 2/3/4, `mediaAssetId` is required)
- `GET /api/v1/message/list` (Bearer token required)
- `POST /api/v1/message/ack/delivered` (Bearer token required)
- `POST /api/v1/message/ack/read` (Bearer token required)
- `POST /api/v1/burn/trigger` (Bearer token required)
- `GET /api/v1/notification/unread-summary` (Bearer token required)

## WebSocket

- Namespace: `/ws`
- Handshake auth: `auth.token` or `Authorization: Bearer <accessToken>`
- Event: `message.ping` -> `message.pong`
- Event: `conversation.join` -> `conversation.joined`
- Event: `conversation.typing.start|stop` -> `conversation.typing.ack`
- Server push: `conversation.typing` (to `conversation:<id>` room)
- Server push: `message.sent` (to `conversation:<id>` room)
- Server push: `message.delivered` (to `conversation:<id>` room)
- Server push: `message.read` (to `conversation:<id>` room)
- Server push: `burn.triggered` (to `conversation:<id>` room)

## Notes

- Database: PostgreSQL via TypeORM
- Cache/online state foundation: Redis provider
- JWT: access token + refresh token + Redis blacklist on logout/refresh rotation
- Security: login brute-force limit by `SEC_LOGIN_MAX_ATTEMPTS` and `SEC_LOGIN_FAIL_WINDOW_SEC`
- Replay guard: message `nonce` must be idempotent (same nonce with different payload will be rejected)
- Media storage: local path by `MEDIA_ROOT`, max upload size by `MEDIA_MAX_BYTES`
- Burn cleanup: burn messages auto-delete on read timeout and also after 24h unread
- Burn send rule: only `messageType` 1/2/3 can be burn; `burnDuration` must be one of `5|10|30|60|300`
- Burn inheritance: if `isBurn` is omitted, backend applies conversation default burn config
- HTTP access log: enabled by default, set `LOG_HTTP=0` to disable
