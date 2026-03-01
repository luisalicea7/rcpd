# RPD — System Architecture

## Overview

RPD is an event-driven e-commerce personalization system that demonstrates how first-party cookies enable real-time, privacy-respecting personalization. The architecture follows a pipeline model: **Capture → Process → Profile → Personalize → Explain**.

```mermaid
graph LR
    A[User Browser] -->|First-Party Cookie| B[Hono API Server]
    B -->|XADD| C[Redis Streams]
    C -->|XREADGROUP| D[Event Consumer]
    D -->|Update| E[Behavioral Profile]
    E -->|Evaluate| F[Personalization Engine]
    F -->|Actions| B
    F -->|WebSocket| G[Backstage Panel]
```

---

## Data Flow Pipeline

The system processes user behavior through four stages, each visible in the Backstage panel:

```mermaid
flowchart TD
    subgraph "1. Capture"
        A1[Page View] --> S[Redis Stream: rpd:events]
        A2[Product View] --> S
        A3[Search] --> S
        A4[Add to Cart] --> S
        A5[Idle / Scroll / Click] --> S
    end

    subgraph "2. Process"
        S -->|Consumer Group| C[Event Consumer]
        C --> P[Profile Builder]
    end

    subgraph "3. Profile"
        P --> I[Interests]
        P --> PS[Price Sensitivity]
        P --> E[Engagement Metrics]
        P --> AR[Abandonment Risk Score]
    end

    subgraph "4. Personalize"
        I --> PE[Personalization Engine]
        PS --> PE
        E --> PE
        AR --> PE
        PE --> D1[Discount Banner]
        PE --> D2[Recommendations]
        PE --> D3[Urgency Alert]
        PE --> D4[Cart Reminder]
    end
```

---

## Consent & Session Flow

No tracking occurs until the user grants explicit consent (GDPR compliance).

```mermaid
sequenceDiagram
    participant U as User Browser
    participant API as Hono API
    participant R as Redis

    U->>API: First visit (no cookie)
    API->>U: Set rpd_session cookie (httpOnly)
    U->>API: POST /api/consent/grant
    API->>R: SET session:{id}:consent "granted" EX 1800
    API->>U: 200 OK — tracking enabled

    Note over U,R: All subsequent events require valid consent

    U->>API: POST /api/events/product-view
    API->>R: Check session:{id}:consent
    R->>API: "granted"
    API->>R: XADD rpd:events ...
    API->>U: 200 OK

    Note over U,R: On consent revocation

    U->>API: POST /api/consent/revoke
    API->>R: SMEMBERS session:{id}:keys
    API->>R: UNLINK tracked session keys + profile/cart/actions
    API->>U: 200 OK — all data deleted
```

Session TTL policy is sliding: session-scoped keys are refreshed to 30 minutes on tracked activity.

---

## Cart Abandonment Risk Algorithm

Explainable weighted scoring model (0–100):

```mermaid
pie title Abandonment Risk Factor Weights
    "Cart Inactivity Time" : 30
    "Idle Behavior" : 25
    "Browse vs Purchase Intent" : 20
    "Price Sensitivity" : 15
    "Session Engagement" : 10
```

| Factor | Weight | Signal | High Risk Indicator |
| --- | --- | --- | --- |
| Cart Inactivity | 0.30 | Time since last cart action | > 10 minutes |
| Idle Behavior | 0.25 | Idle duration detected | > 60 seconds |
| Browse vs Purchase | 0.20 | Views without cart adds | High view count, empty cart |
| Price Sensitivity | 0.15 | Average price viewed | Budget range (< $50 avg) |
| Session Engagement | 0.10 | Event count, scroll depth | Low interaction count |

**Risk levels:** Low (0–35) · Medium (36–60) · High (61–100)

---

## Backstage Panel — Real-Time Transparency

The WebSocket-based Backstage panel streams explanations at each pipeline stage:

```mermaid
sequenceDiagram
    participant U as User
    participant API as Hono API
    participant WS as WebSocket
    participant BS as Backstage Panel

    U->>API: Views product (Electronics, $79.99)
    API->>WS: 1_capture: "You viewed Wireless Headphones"
    WS->>BS: Display event

    API->>WS: 2_learn: "Interest in Electronics → 45/100"
    WS->>BS: Display profile update

    API->>WS: 3_decide: "Triggered: product recommendation"
    WS->>BS: Display action

    API->>WS: 4_explain: "3 Electronics views, score 45/100 → suggesting similar items"
    WS->>BS: Display reasoning
```

---

## Redis Data Model

All session-scoped keys enforce a 30-minute sliding TTL for GDPR compliance and active-session continuity.

```mermaid
erDiagram
    SESSION ||--o| CONSENT : has
    SESSION ||--o| DATA : stores
    SESSION ||--o| PROFILE : builds
    SESSION ||--o| CART : maintains
    SESSION ||--o{ ACTIONS : triggers

    SESSION {
        string rpd_session "httpOnly cookie"
    }
    CONSENT {
        string status "granted"
        int ttl "1800s sliding"
    }
    DATA {
        string createdAt
        string lastCartAddAt
        string lastIdleAt
    }
    PROFILE {
        json interests "CategoryInterest[]"
        json priceStats "PriceStatistics"
        json abandonmentRisk "AbandonmentRisk"
        int eventCount
    }
    CART {
        json items "CartItem[]"
        float totalValue
        int itemCount
    }
    ACTIONS {
        string actionType
        json reasoning "ActionReasoning"
        json content "ActionContent"
    }
    KEYINDEX {
        set keys "session-owned keys"
    }
```

**Key patterns:**

| Key | Type | TTL | Description |
| --- | --- | --- | --- |
| `session:{id}:consent` | String | 30min | Consent status |
| `session:{id}:data` | Hash | 30min | Session metadata |
| `session:{id}:keys` | Set | 30min | Session-owned key index for revoke cleanup |
| `profile:{id}` | String (JSON) | 30min | Behavioral profile |
| `cart:{id}` | String (JSON) | 30min | Shopping cart |
| `action:{actionId}` | String (JSON) | 30min | Individual action |
| `actions:{id}` | List | 30min | Action history |
| `rpd:events` | Stream | — | Event stream (consumer group) |

`cart_abandon` is treated as a derived internal signal from cart inactivity + idle behavior, not a client-facing event endpoint.

## Stream Reliability

The event pipeline uses at-least-once processing with idempotent reducers:

- `XREADGROUP` for primary consumption
- `XAUTOCLAIM` to recover stale pending entries after worker restart/crash
- `XACK` only after profile/action persistence succeeds
- Per-session dedupe marker for processed stream IDs
- `XTRIM` retention policy to bound stream growth

---

## Infrastructure

```mermaid
graph TD
    subgraph "Docker Compose (Development)"
        APP[Hono App :3000]
        REDIS[Redis 7 Alpine :6379]
        APP <-->|redis://redis:6379| REDIS
    end

    subgraph "Railway (Production)"
        APP_PROD[Hono App]
        REDIS_PROD[Redis Plugin]
        APP_PROD <-->|REDIS_URL| REDIS_PROD
    end

    subgraph "Frontend (TBD)"
        FE[React or Svelte :5173]
        FE -->|REST API + WebSocket| APP
    end
```

---

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Backend | Hono | Lightweight HTTP framework |
| Runtime | Node.js 20 | Server runtime |
| Language | TypeScript | Type safety |
| Data Store | Redis 7 | Streams, profiles, sessions |
| Validation | Zod | Request schema validation |
| Real-time | WebSocket | Backstage panel streaming |
| Containers | Docker Compose | Development environment |
| Hosting | Railway | Production deployment |
| Frontend | TBD (React/Svelte) | User interface |
