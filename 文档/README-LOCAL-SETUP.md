# Local Setup And Verification

## 1. Runtime Prerequisites

- Node.js `>=22`
- pnpm `>=10`
- Docker + Docker Compose

macOS (if using Colima):

```bash
colima start
```

## 2. Infrastructure Services

Required services:

- PostgreSQL 16
- Redis 7
- MinIO (S3-compatible object storage)

Start:

```bash
cp .env.example .env
docker-compose up -d
```

Check:

```bash
docker-compose ps
```

Service endpoints:

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`

## 3. Backend Startup

```bash
cp apps/backend/.env.example apps/backend/.env
pnpm install
pnpm start:backend
```

Health check:

```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

Expected:

```json
{"success":true,"data":{"status":"ok","service":"security-chat-backend"}}
```

## 4. Desktop Startup (Optional)

```bash
pnpm start:desktop
```

## 5. V1 Backend Acceptance

Keep backend running, then run:

```bash
pnpm verify:backend:v1
```

This command executes:

1. `pnpm smoke:backend:v1`
2. `pnpm test:backend:e2e:v1`
3. `pnpm test:backend:ws:v1`
