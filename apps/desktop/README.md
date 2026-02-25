# Desktop Frontend (React + Vite)

## Run

```bash
cp apps/desktop/.env.example apps/desktop/.env
pnpm start:desktop
```

Default dev server:

- `http://127.0.0.1:4173`

## Features in this milestone

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
- Friend workspace:
  - Search user (`/friend/search`)
  - Send request (`/friend/request`)
  - Handle incoming request (`/friend/respond`)
  - Block/unblock (`/friend/block`, `/friend/unblock`)
  - List friend/blocked (`/friend/list`, `/friend/blocked`)

## Extensible structure

- `src/core`: API client, shared types, and `useChatClient` state/effects orchestration
- `src/features/auth`: Auth screens/components
- `src/features/chat`: Chat domain UI components (sidebar, chat panel)
- `src/features/friend`: Friend domain UI components

Recommended extension pattern:

- Add new domain in `src/features/<domain>`
- Keep network and cross-domain state flow in `src/core`
- Keep feature components presentation-focused and stateless where possible
