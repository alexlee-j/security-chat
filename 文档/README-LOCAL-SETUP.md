# Local Infra Setup

## Services

- PostgreSQL 16
- Redis 7
- MinIO (S3-compatible object storage)

## Start

```bash
cp .env.example .env
docker-compose up -d
```

## Check

```bash
docker-compose ps
```

## Access

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`
