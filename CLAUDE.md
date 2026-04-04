# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Security Chat is a secure messaging application with end-to-end encryption using the Signal Protocol. The monorepo contains:
- **Backend**: NestJS API server with PostgreSQL, Redis, and WebSocket support
- **Desktop**: Tauri 2.x + React desktop application (macOS/Windows/Linux)
- **Mobile**: React Native mobile application

## Common Commands

### Development
```bash
pnpm install              # Install all dependencies
pnpm start:backend:dev    # Start NestJS backend in watch mode (port 3000)
pnpm run tauri:dev        # Start Tauri desktop app in development
```

### Building
```bash
pnpm build:backend         # Build NestJS backend
pnpm build:desktop         # Build Tauri desktop app
pnpm run tauri:build      # Build Tauri desktop app (outputs to src-tauri/target/release/bundle/)
```

## Testing

See `.claude/skills/testing.md` for comprehensive testing guide including:
- Backend API testing
- Tauri GUI testing with Playwright
- Signal protocol encryption testing (Rust cargo tests)
- E2EE end-to-end testing
- CORS verification

## Architecture

### Backend (apps/backend)
- NestJS 11.x with TypeORM for PostgreSQL ORM
- Redis for caching and pub/sub
- JWT authentication with refresh tokens
- WebSocket via Socket.IO for real-time messaging
- Global prefix `/api/v1` for all HTTP routes

Key modules under `src/modules/`:
- `auth/` - Login, register, token management
- `user/` - User profile, device registration, Signal keys
- `message/` - Message sending, retrieval, acknowledgments
- `conversation/` - Chat sessions (direct & group)
- `friend/` - Friend requests, block list
- `burn/` - "阅后即焚" (burn-after-reading) message handling
- `mail/` - Email service (SMTP)
- `media/` - File upload/download via MinIO

### Desktop App (apps/desktop)
- Tauri 2.x with React 18 + TypeScript + Vite
- Signal Protocol via libsignal-protocol (Rust library)
- WebSocket connection for real-time messaging
- Local storage: SQLite for messages, macOS Keychain for keychain data

### Frontend-Backend Communication
- REST API: `http://localhost:3000/api/v1/*`
- WebSocket: `http://localhost:3000/ws`
- CORS is configured in `apps/backend/src/main.ts` - development allows all localhost origins

### Database Schema (PostgreSQL)
Core tables: `users`, `devices`, `one_time_prekeys`, `friendships`, `conversations`, `conversation_members`, `messages`, `burn_events`, `notifications`, `media_assets`

## Environment Configuration

Environment files are loaded in this order (later values override earlier):
1. Project root `.env` - contains SMTP credentials and Docker config
2. `apps/backend/.env.development` - NestJS dev configuration

The NestJS `ConfigModule` (`apps/backend/src/app.module.ts`) is configured with `isGlobal: true`, making config available throughout the app via `@Inject(ConfigService)`.

**Critical**: When adding new environment variables that are required at startup (like CORS checks), load them manually at the top of `main.ts` before `NestFactory.create()`. See the existing `loadEnv()` function in `main.ts` for the pattern.

## Signal Protocol Implementation

The Signal Protocol implementation uses:
- **X3DH** for initial key exchange
- **Double Ratchet** for message encryption
- **Sender Keys** for group messaging
- Keys are stored per-device in `devices` and `one_time_prekeys` tables
- Prekey upload happens after login, before messaging

## Important Patterns

### Backend Module Creation
New NestJS modules should follow the existing pattern:
```
src/modules/<name>/
  ├── <name>.module.ts
  ├── <name>.controller.ts (if exposing HTTP endpoints)
  └── <name>.service.ts
```

### API Response Format
All API responses follow `ApiEnvelope<T>` format:
```typescript
{ success: true, data: T, timestamp: string }
{ success: false, error: { code: number, message: string }, timestamp: string, traceId: string }
```

### Login DTO
The login DTO uses `account` field (not `email`):
```typescript
{ account: string, password: string }
```

## Docker & Production

- `docker-compose.prod.yml` - Production stack with backend, PostgreSQL, Redis, MinIO, Nginx
- `deploy.sh` - Deployment script
- Backend runs on port 3000, Nginx proxies to it from port 80/443


Quick test commands:
```bash
pnpm verify:backend:v1    # All backend tests
cargo test signal::       # Signal protocol tests
pnpm run tauri:dev        # GUI testing
```
