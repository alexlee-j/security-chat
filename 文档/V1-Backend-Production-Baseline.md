# V1 Backend Production Baseline

## 1. Runtime Profile

- Node.js: `>=22`
- Start command: `pnpm start:backend`
- `NODE_ENV=production`
- `PORT` explicitly configured
- Disable TypeORM auto sync in production:
  - `DB_SYNC=false`

## 2. Database

- PostgreSQL with least-privilege app user
- Required env:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
- Index and table growth checks:
  - `messages`
  - `conversation_members`
  - `friendships`
  - `media_assets`
  - `burn_events`

## 3. Redis

- Required env:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD` (recommended)
- Production use cases:
  - token blacklist
  - online status TTL
  - login brute-force counters

## 4. Security Controls (V1)

- JWT settings:
  - `JWT_SECRET` must be strong random
  - `JWT_EXPIRES_IN` short-lived (default `15m`)
  - `JWT_REFRESH_EXPIRES_IN` controlled (default `7d`)
- Login brute-force limit:
  - `SEC_LOGIN_MAX_ATTEMPTS` (default `5`)
  - `SEC_LOGIN_FAIL_WINDOW_SEC` (default `300`)
- Replay protection:
  - message `nonce` idempotent
  - same nonce + different payload rejected

## 5. Media Storage

- Local storage path for V1:
  - `MEDIA_ROOT` (default `/tmp/security-chat-media`)
- Upload size guard:
  - `MEDIA_MAX_BYTES` (default `104857600` = 100MB)
- Access control:
  - uploader-only before attachment
  - conversation-member access after attachment

## 6. Burn Rules

- Read-trigger timeout delete by `burn_duration`
- Unread auto-delete after 24h
- Burn deletes broadcast via WebSocket `burn.triggered`
- Burn send constraints:
  - supported message types: `1(text) / 2(image) / 3(audio)`
  - `burn_duration` allowed values: `5 / 10 / 30 / 60 / 300` seconds
- Conversation-level default burn is persisted in conversation fields and exposed by:
  - `GET /api/v1/conversation/:conversationId/burn-default`
  - `POST /api/v1/conversation/:conversationId/burn-default`

## 7. Health and Smoke

- Health endpoint:
  - `GET /api/v1/health`
- V1 smoke script:
  - `pnpm smoke:backend:v1`
  - covers register, direct conversation, media upload/attach, media message send, list, unread summary
  - optional env controls:
    - `BASE_URL`
    - `SMOKE_USER_PREFIX`
    - `SMOKE_TIMEOUT_MS`
    - `SMOKE_KEEP_ARTIFACTS=1`
    - `SMOKE_MEDIA_KIND` and `SMOKE_MESSAGE_TYPE` (`2|3|4`)
    - `SMOKE_MESSAGE_LIMIT`

## 8. Release Gates

Before tagging V1 backend release:

1. `pnpm build:backend` passes
2. `pnpm smoke:backend:v1` passes on staging
3. `DB_SYNC=false` verified
4. JWT secret rotation policy confirmed
5. Redis password and network policy confirmed
6. Media root persistence and disk monitor confirmed
