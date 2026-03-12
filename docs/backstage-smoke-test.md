# Backstage WebSocket v1 smoke test

## 1) Start API + consumer

```bash
bun run dev
bun run consume:profile:loop
```

## 2) Open WebSocket connection

Use the same session cookie context used by API calls.

Example with `wscat`:

```bash
wscat -c ws://localhost:3000/api/backstage/ws
```

## 3) Trigger events

```bash
# assumes consent already granted and same cookie jar
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/events/product-view \
  -H 'content-type: application/json' \
  -d '{"productId":"ele-001","viewDuration":12000}'

curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/events/add-to-cart \
  -H 'content-type: application/json' \
  -d '{"productId":"ele-001","quantity":1}'

curl -b cookies.txt -c cookies.txt http://localhost:3000/api/personalization/me
```

## 4) Verify WS messages

You should observe ordered messages per trace pipeline:

1. `capture`
2. `learn`
3. `decide`
4. `explain`

## 5) Check status endpoint

```bash
curl http://localhost:3000/api/backstage/status
```

Expected shape:

```json
{
  "ok": true,
  "version": "v1",
  "clients": 1
}
```
