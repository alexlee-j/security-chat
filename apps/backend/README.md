# Backend (NestJS)

## Run

```bash
cp apps/backend/.env.example apps/backend/.env
pnpm install
pnpm start:backend:dev
```

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
- `GET /api/v1/conversation/list?limit=50` (Bearer token required)
- `POST /api/v1/message/send` (Bearer token required)
- `GET /api/v1/message/list` (Bearer token required)
- `POST /api/v1/message/ack/delivered` (Bearer token required)
- `POST /api/v1/message/ack/read` (Bearer token required)
- `POST /api/v1/burn/trigger` (Bearer token required)

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
