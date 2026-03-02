# RPD Backend (Scaffold)

Event-driven personalization backend using Hono + Redis.

## Package manager

This repo is **Bun-first**.

## Quick start

1. Copy env:

```bash
cp .env.example .env
```

2. Configure Redis URL in `.env`.

You can use either:
- Local Redis: `redis://localhost:6379`
- Cloud Redis: `rediss://<user>:<password>@<host>:<port>`

If using local Redis via Docker:

```bash
docker compose up -d redis
```

3. Install deps + run dev server:

```bash
bun install
bun run dev
```

Server runs on `http://localhost:3000` by default.

## Implemented in this phase

- App bootstrap (`src/app.ts`, `src/index.ts`)
- Health endpoint: `GET /health`
- Session cookie middleware (`rpd_session`)
- Consent endpoints:
  - `GET /api/consent/status`
  - `POST /api/consent/grant`
  - `POST /api/consent/revoke`
- Sliding TTL refresh for session keys
- Session-owned key index for deterministic revoke cleanup (`session:{id}:keys`)
- Product catalog API with **120 curated products**:
  - `GET /api/products`
  - `GET /api/products/:id`
  - filtering (`category`, `priceRange`, `minPrice`, `maxPrice`, `q`) + pagination (`limit`, `offset`)

## Manual test flow

```bash
# 1) Health
curl -i http://localhost:3000/health

# 2) Check consent status (stores cookie)
curl -i -c cookies.txt http://localhost:3000/api/consent/status

# 3) Grant consent
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/consent/grant

# 4) Verify status now granted
curl -i -b cookies.txt http://localhost:3000/api/consent/status

# 5) Revoke and cleanup
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/consent/revoke
```

## Product catalog test flow

```bash
# List first page
curl -s "http://localhost:3000/api/products" | head

# Filter by category
curl -s "http://localhost:3000/api/products?category=electronics&limit=5"

# Filter by price range and search
curl -s "http://localhost:3000/api/products?priceRange=premium&q=smart&limit=10"

# Product details by id
curl -s "http://localhost:3000/api/products/ele-001"
```

Optional Redis checks:

For local Redis:
```bash
docker exec -it rcpd-redis-1 redis-cli
# then inspect keys
KEYS session:*
TTL session:<id>:consent
SMEMBERS session:<id>:keys
```

For cloud Redis, use your provider dashboard/inspector or connect with redis-cli using your TLS URL.
