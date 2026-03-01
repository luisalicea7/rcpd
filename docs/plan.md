# RPD — Real-time Personalization Demo

## Research Foundation

Based on academic research by Joshua Lergier Nevarez (UAGM Cupey, CoIDINE 2025):

**Research question:** "How do first-party cookies contribute to automated, personalized feedback in e-commerce platforms?"

**Key findings that drive our design:**

- First-party cookies are the central tool for legitimate personalization post-GDPR (Miller & Skiera 2024, Murga 2024)
- 97%+ of modern sites use first-party identifiers as their tracking base (Chen et al. 2021)
- 78% of companies consider first-party data their most important asset (Twilio Segment 2023)
- Behavioral signals from cookies enable real-time inference of intent and navigation patterns (Polonioli 2022)
- Personalization works under strict privacy when there's real consent, transparency, and domain-limited use (GDPR/Meta 2023 precedent)
- Users accept first-party cookies when they provide visible value (IAB Spain 2024)

**Our system IS the working demonstration of these findings.** The Backstage panel makes the entire pipeline transparent: cookie → behavioral signal → profile → personalized action → explanation of why.

## Context

Build an event-driven e-commerce demo that makes personalization transparent. Users browse a mock store while the system captures events via a first-party session cookie, streams them through Redis, builds behavioral profiles, and triggers explainable personalized actions. A "Backstage" panel streams live explanations via WebSocket, showing non-technical viewers the complete pipeline.

**Stack**: Hono (backend), Redis (streams + storage), Docker Compose, Railway deployment. Frontend framework TBD (React or Svelte) — backend API will be framework-agnostic.

## Implementation Order

Build order should prioritize dependencies for profile and personalization logic:

1. Block 1 — Scaffold + infrastructure
2. Block 2 — Session, cookie, and consent
3. Block 6 (minimal) — Product catalog + cart primitives
4. Block 3 — Event capture + stream publishing
5. Block 4 — Event processing + profile builder
6. Block 5 — Personalization engine
7. Block 7 — Backstage WebSocket transparency layer
8. Block 8 — Integration, TTL management, deployment polish

---

## Block 1 — Project Scaffold + Infrastructure

Create project foundation: Docker Compose (Redis + app), Hono server, TypeScript config.

**Files to create:**

- `docker-compose.yml` — Redis 7 Alpine + app service
- `Dockerfile` — Node 20 Alpine
- `package.json` — hono, redis, zod, @hono/node-server, tsx
- `tsconfig.json`
- `.env.example` — PORT, REDIS_URL, FRONTEND_URL, SESSION_TTL
- `.gitignore`
- `src/index.ts` — entry point, starts server + Redis
- `src/app.ts` — Hono app with CORS, health check at `/health`
- `src/config/redis.ts` — Redis client connection

**Verify:** `docker-compose up` → `GET /health` returns `{"status":"ok"}`, Redis PING returns PONG.

---

## Block 2 — Session & Cookie Management

First-party cookie creation, session storage in Redis, GDPR consent gating, and sliding TTL refresh.

Per the research: cookies must be created by the domain the user visits, require explicit consent, stay within the domain, and have transparent purpose. The Meta 2023 precedent confirms behavioral analysis cannot happen without consent.

**Files to create:**

- `src/middleware/session.ts` — sets `rpd_session` httpOnly cookie, stores sessionId in context
- `src/middleware/consent.ts` — blocks requests without consent (returns 403)
- `src/routes/consent.ts` — `GET /api/consent/status`, `POST /api/consent/grant`, `POST /api/consent/revoke`
- `src/types/index.ts` — SessionId, Session, ConsentStatus types

**Redis keys:**

- `session:{id}:consent` → `"granted"` (TTL 30min, sliding on activity)
- `session:{id}:data` → Hash with timestamps (TTL 30min, sliding on activity)
- `session:{id}:keys` → Set of Redis keys owned by the session for deterministic revoke cleanup

**Verify:** Grant consent → check Redis key exists with TTL. Send tracked activity → TTL refreshes. Revoke → all tracked session keys deleted.

---

## Block 3 — Event Capture & Redis Streams

Define event types and capture endpoints. Event types derived directly from the research's tracking list (presentation slide 3):

| Research tracking point    | Event type                                                    |
| -------------------------- | ------------------------------------------------------------- |
| Páginas visitadas          | `page_view`                                                   |
| Búsquedas                  | `search`                                                      |
| Vistas repetidas           | `product_view` (with repeat detection)                        |
| Abandono del carrito       | `cart_abandon` (derived internal signal, not public endpoint) |
| Tiempo de permanencia      | `idle` / `product_view.viewDuration`                          |
| Clics y desplazamientos    | `click` / `scroll`                                            |
| Preferencias de filtros    | `filter_change`                                               |
| Agregar/quitar del carrito | `add_to_cart` / `remove_from_cart`                            |

**Files to create:**

- `src/types/events.ts` — EventType enum + typed event interfaces
- `src/services/eventProducer.ts` — `XADD` to `rpd:events` stream
- `src/routes/events.ts` — POST endpoints with Zod validation, protected by session + consent middleware
  - `/api/events/page-view`
  - `/api/events/product-view` (tracks repeat views per product)
  - `/api/events/search`
  - `/api/events/add-to-cart`
  - `/api/events/remove-from-cart`
  - `/api/events/idle`
  - `/api/events/click`
  - `/api/events/scroll`
  - `/api/events/filter-change`

`cart_abandon` is computed by processing logic from inactivity/idle/cart state and can be emitted as an internal stream event for auditability.

**Verify:** POST event → check `XRANGE rpd:events - +` shows entry. Invalid data → 400. No consent → 403.

---

## Block 4 — Event Processing & Profile Building

Redis Streams consumer group processes events into behavioral profiles. This is the core of what the research describes as "capturing behavioral signals to infer intent and navigation patterns" (Polonioli 2022).

**Files to create:**

- `src/services/eventConsumer.ts` — consumer group `profile-builders`, reads with `XREADGROUP`, reclaims stale pending work with `XAUTOCLAIM`, ACKs only after successful writes
- `src/services/profileBuilder.ts` — updates profile per event:
  - **Interests**: category scores based on view count + duration + repeat views
  - **Price sensitivity**: avg/min/max price viewed, budget/mid/premium classification
  - **Engagement metrics**: scroll depth, click patterns, filter usage
  - **Cart abandonment risk**: weighted score (0-100) from 5 factors:
    1. Cart inactivity time (weight 0.30)
    2. Idle behavior (weight 0.25)
    3. Browse-vs-purchase intent (weight 0.20)
    4. Price sensitivity (weight 0.15)
    5. Session engagement — events, scroll depth, repeat views (weight 0.10)
- `src/types/profile.ts` — BehavioralProfile, CategoryInterest, PriceStatistics, AbandonmentRisk
- `src/routes/profile.ts` — `GET /api/profile`

**Processing reliability requirements:**

- At-least-once stream handling with idempotent profile reducers
- Per-session dedupe marker for processed event IDs to prevent double counting
- `XACK` after profile/action persistence succeeds
- Stream retention policy with `XTRIM` to avoid unbounded growth
- Recover pending messages on worker restart/crash

**Redis keys:**

- `profile:{sessionId}` → JSON BehavioralProfile (TTL 30min)

**Verify:** Send multiple product-view events → `GET /api/profile` shows interests + price stats. Replay/reclaim pending messages → profile remains correct (no duplicate inflation). Add to cart + idle/inactivity → abandonment risk increases.

---

## Block 5 — Personalization Engine

Rule-based engine that triggers the real-time activations described in the research (presentation slide 4):

| Research activation          | Our implementation                                        |
| ---------------------------- | --------------------------------------------------------- |
| Pop-ups de descuento         | `discount_banner` — triggered by high abandonment risk    |
| Recomendaciones dinámicas    | `product_recommendation` — triggered by category interest |
| Alertas de urgencia          | `urgency_alert` — triggered by price sensitivity + risk   |
| Recordatorios de carrito     | `cart_reminder` — triggered by cart inactivity time       |
| Reorganización del contenido | `category_highlight` — triggered by top interest category |
| Chat proactivo               | Future: out of MVP scope                                  |

**Files to create:**

- `src/types/personalization.ts` — ActionType enum, PersonalizationAction, ActionReasoning
- `src/services/personalizationEngine.ts` — rules evaluated by priority:
  1. **Cart abandonment discount** — risk > 60 → 10-15% discount banner
  2. **Cart reminder** — items in cart + inactivity > 5min → reminder
  3. **Category recommendations** — top interest score > 30 → product suggestions
  4. **Price-sensitive urgency** — budget shopper + medium risk → urgency alert ("limited stock")
  5. **Category highlight** — strong interest pattern → reorganize content
- `src/routes/personalization.ts` — `GET /api/personalization/actions`, `GET /api/personalization/history`

Each action includes full reasoning: which rule fired, confidence score, human-readable explanation. This explainability is what makes our demo unique — showing that privacy-respecting personalization can be both effective and understandable.

**Redis keys:**

- `action:{actionId}` → JSON PersonalizationAction (TTL 30min)
- `actions:{sessionId}` → List of actionIds (TTL 30min)

**Verify:** Build up profile with events → `GET /api/personalization/actions` returns actions with explanations.

---

## Block 6 — Product Catalog & Cart (Dependency Block)

Mock storefront data and cart management. Implement a minimal version of this block before Blocks 4-5 so profile and personalization logic can rely on stable product/category/price/cart primitives.

**Files to create:**

- `src/types/product.ts` — Product, CartItem, Cart interfaces
- `src/data/products.ts` — ~14 products across 3 categories (Electronics, Sports, Home) at budget/mid/premium price points
- `src/services/cartService.ts` — add/remove/update/clear cart items, stored in Redis
- `src/routes/products.ts` — `GET /api/products` (filter by category, price), `GET /api/products/:id`, `GET /api/products/search?q=`
- `src/routes/cart.ts` — `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`

**Redis keys:**

- `cart:{sessionId}` → JSON Cart (TTL 30min)

**Verify:** Browse products, add to cart, verify cart totals.

---

## Block 7 — Backstage Panel (WebSocket)

The transparency layer that answers the research question directly. Shows non-technical viewers the complete pipeline: **what you did → what the system learned → what it decided → why it made that decision.**

This demonstrates the research's core thesis: first-party cookies enable legitimate personalization when there's full transparency about what data is collected and how it's used.

**Files to create:**

- `src/websocket/backstage.ts` — BackstageManager class, manages WebSocket clients per session, sends structured messages at each pipeline step:
  - `1_capture` — "You viewed Wireless Headphones in Electronics ($79.99)"
  - `2_learn` — "Your interest in Electronics increased to 45/100. Price range: mid."
  - `3_decide` — "Triggered: product recommendation for Electronics"
  - `4_explain` — "Because you viewed 3 Electronics products (score 45/100), we're suggesting similar items. Confidence: 72%."
- `src/routes/backstage.ts` — `WS /api/backstage/ws`, `GET /api/backstage/status`

**Modify:** eventProducer, profileBuilder, and personalizationEngine to call backstageManager when a client is connected.

**Verify:** Connect WebSocket → perform actions → observe real-time messages at each pipeline step.

---

## Block 8 — Integration & Polish

Wire everything together, ensure GDPR compliance, prepare deployment.

**Files to create/modify:**

- `src/app.ts` — mount all route groups under `/api/*`
- `src/index.ts` — start Redis, event consumer, HTTP server, graceful shutdown
- `src/services/ttlManager.ts` — refresh TTLs on activity, cleanup helper
- `railway.json` + `railway.toml` — Railway deployment config

**GDPR compliance (per research):**

- Explicit consent gating before any tracking begins
- All session-scoped Redis keys use 30-min sliding TTL (automatic data expiration + active-session continuity)
- Consent revocation deletes all session data immediately
- Data never leaves the domain (no third-party transfers)
- Backstage panel provides full transparency into what's collected and why
- Distinguishes between necessary cookies and personalization cookies (Meta precedent)

**Data deletion strategy:**

- Do not use wildcard delete syntax (unsupported in Redis `DEL`)
- Revoke flow deletes tracked keys using `session:{id}:keys` + `UNLINK`/`DEL`

**Verify full flow:**

1. `POST /api/consent/grant` — explicit consent
2. `GET /api/products` → browse catalog
3. `POST /api/events/product-view` (multiple, with repeat views)
4. `GET /api/profile` → see interests, price sensitivity, engagement
5. `POST /api/cart/items` → add item
6. `POST /api/events/idle` → trigger idle
7. `GET /api/personalization/actions` → see discount banner + cart reminder with explanations
8. `WS /api/backstage/ws` → verify real-time pipeline stream
9. `POST /api/consent/revoke` → verify all data deleted
