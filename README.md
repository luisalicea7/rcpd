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

## API endpoints (current)

- Health:
  - `GET /health`
- Consent:
  - `GET /api/consent/status`
  - `POST /api/consent/grant`
  - `POST /api/consent/revoke`
- Products:
  - `GET /api/products`
  - `GET /api/products/:id`
- Events:
  - `POST /api/events/page-view`
  - `POST /api/events/product-view`
  - `POST /api/events/search`
  - `POST /api/events/add-to-cart`
  - `POST /api/events/remove-from-cart`
  - `POST /api/events/idle`
  - `POST /api/events/click`
  - `POST /api/events/scroll`
  - `POST /api/events/filter-change`
- Cart:
  - `GET /api/cart`
  - `POST /api/cart/items`
  - `PATCH /api/cart/items/:id`
  - `DELETE /api/cart/items/:id`
- Profile:
  - `GET /api/profile/me` (legacy)
  - `GET /api/profile` (compat shape)
- Personalization:
  - `GET /api/personalization/me` (legacy)
  - `GET /api/personalization/actions` (compat)
  - `GET /api/personalization/history` (compat)

## Personalization/profile compatibility notes

Legacy `/me` endpoints are preserved. Spec-compatible endpoints are added:

- `GET /api/profile` returns:
  - `sessionId`
  - `profile` (same object returned by `/api/profile/me`)
- `GET /api/personalization/actions` returns:
  - `sessionId`
  - `generatedAt`
  - `actions`
- `GET /api/personalization/history` returns:
  - `sessionId`
  - `count`
  - `history` (most recent generated actions)

## Event consumer reliability

Profile consumer now uses Redis consumer groups for at-least-once reliability:

- `XGROUP CREATE` bootstraps consumer group (idempotent)
- `XREADGROUP` for normal consumption
- `XACK` only after successful profile update
- `XAUTOCLAIM` to reclaim stale pending entries
- Per-session dedupe marker (`consumer:profile:processed:{sessionId}`) to reduce accidental double-processing
- Stream trimming on publish via `XTRIM MAXLEN ~` using `EVENTS_STREAM_MAXLEN`

## Running the worker (recommended deployment pattern)

The API process does **not** auto-run the profile consumer worker.
Run worker separately (separate process/container):

```bash
# one-shot batch (useful for ad-hoc runs)
bun run consume:profile:once

# long-running consumer (production)
bun run consume:profile:loop
```

In production, deploy at least:
- 1 API service (`bun run start`)
- 1 worker service (`bun run consume:profile:loop`)

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
