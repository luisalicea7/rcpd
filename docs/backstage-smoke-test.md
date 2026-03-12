# Backstage WebSocket v1 smoke test

## 1) Start API + consumer

```bash
bun run dev
bun run consume:profile:loop
```

## 2) Create session + consent cookie jar first

Backstage WS is session-scoped. You must create and reuse the same cookie state.

```bash
# establish session cookie
curl -i -c cookies.txt http://localhost:3000/api/consent/status

# grant consent using same cookie jar
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/consent/grant
```

## 3) Extract Cookie header from cookies.txt

```bash
COOKIE_HEADER=$(awk '($0 !~ /^#/ && $6 != "") {printf "%s=%s; ", $6, $7}' cookies.txt | sed 's/; $//')
echo "$COOKIE_HEADER"
```

## 4) Open WebSocket with the same Cookie header

Example with `wscat`:

```bash
wscat -c ws://localhost:3000/api/backstage/ws -H "Cookie: $COOKIE_HEADER"
```

Alternative (`websocat`):

```bash
websocat -H="Cookie: $COOKIE_HEADER" ws://localhost:3000/api/backstage/ws
```

## 5) Trigger events using the same cookie jar

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/events/product-view \
  -H 'content-type: application/json' \
  -d '{"productId":"ele-001","viewDuration":12000}'

curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/events/add-to-cart \
  -H 'content-type: application/json' \
  -d '{"productId":"ele-001","quantity":1}'

# optional: preserve correlation from prior event id
# curl -b cookies.txt -c cookies.txt -H "x-trace-id: <stream-id>" http://localhost:3000/api/personalization/me
curl -b cookies.txt -c cookies.txt http://localhost:3000/api/personalization/me
```

## 6) Verify WS messages

You should observe ordered pipeline messages per trace:

1. `capture`
2. `learn`
3. `decide`
4. `explain`

## 7) Check status endpoint

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
