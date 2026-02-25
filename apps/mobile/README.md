# Mobile Frontend (Expo)

## Run

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @security-chat/mobile start
```

## UI direction

- Telegram-style visual language (dark chat list + light bubble chat area)
- Top tab rail reserved for feature expansion (`Chats`, `Friends`)
- Rounded composer, avatar list rows, unread badge and timestamp patterns

## Implemented

- Login (`/auth/login`)
- Conversation list (`/conversation/list`)
- Create direct conversation (`/conversation/direct`)
- Message list/send (`/message/list`, `/message/send`)
- Ack delivered/read (`/message/ack/delivered`, `/message/ack/read`)
- WebSocket realtime events:
  - `message.sent`
  - `message.delivered`
  - `message.read`
  - `burn.triggered`
  - `conversation.typing`
