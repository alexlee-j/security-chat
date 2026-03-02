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
- Message type support (`text/image/voice/file`)
- Media upload/send (`/media/upload` + `mediaAssetId`)
- Media open flow:
  - image: in-app preview
  - voice: in-app play/stop
  - file: download then system share/open
- Burn options (`isBurn`, `burnDuration`, manual trigger `/burn/trigger`)
- Conversation default burn config sync (`/conversation/:conversationId/burn-default`)
- Ack delivered/read (`/message/ack/delivered`, `/message/ack/read`)
- Friend workspace:
  - Search user (`/friend/search`)
  - Send request (`/friend/request`)
  - Handle incoming request (`/friend/respond`)
  - Block/unblock (`/friend/block`, `/friend/unblock`)
  - List friend/blocked (`/friend/list`, `/friend/blocked`)
- WebSocket realtime events:
  - `message.sent`
  - `message.delivered`
  - `message.read`
  - `burn.triggered`
  - `conversation.updated`
  - `conversation.typing`

## Notes

- File message does not allow burn mode (aligned with backend validation).
- Composer `+` button selects local file and uploads before sending.
