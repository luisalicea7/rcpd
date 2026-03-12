import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import type {
  AbandonmentRisk,
  BehavioralProfile,
  CategoryInterest,
  EngagementMetrics,
  PriceStatistics,
} from "../types/profile.js";

const MIN_ACTIVE_IDLE_MS = 5000;

function profileKey(sessionId: string): string {
  return `profile:${sessionId}`;
}

function defaultProfile(sessionId: string): BehavioralProfile {
  return {
    sessionId,
    interests: [],
    priceStats: null,
    engagement: {
      totalEvents: 0,
      totalScrollEvents: 0,
      avgScrollDepth: 0,
      clickCount: 0,
      filterUsageCount: 0,
      searchCount: 0,
      repeatViewCount: 0,
    },
    abandonmentRisk: {
      score: 0,
      factors: {
        cartInactivity: 0,
        idleBehavior: 0,
        browseVsPurchase: 0,
        priceSensitivity: 0,
        sessionEngagement: 0,
      },
    },
    cartLastUpdated: null,
    lastUpdated: Date.now(),
  };
}

function isValidBehavioralProfile(value: unknown): value is BehavioralProfile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  if (typeof v.sessionId !== "string") return false;
  if (!Array.isArray(v.interests)) return false;

  if (!v.engagement || typeof v.engagement !== "object") return false;
  const e = v.engagement as Record<string, unknown>;
  const engagementKeys = [
    "totalEvents",
    "totalScrollEvents",
    "avgScrollDepth",
    "clickCount",
    "filterUsageCount",
    "searchCount",
    "repeatViewCount",
  ];
  if (
    engagementKeys.some(
      (k) => k !== "totalScrollEvents" && typeof e[k] !== "number",
    )
  ) {
    return false;
  }

  if (e.totalScrollEvents !== undefined && typeof e.totalScrollEvents !== "number") {
    return false;
  }

  if (!v.abandonmentRisk || typeof v.abandonmentRisk !== "object") return false;
  const ar = v.abandonmentRisk as Record<string, unknown>;
  if (typeof ar.score !== "number") return false;
  if (!ar.factors || typeof ar.factors !== "object") return false;

  if (v.cartLastUpdated !== null && typeof v.cartLastUpdated !== "number") return false;
  if (typeof v.lastUpdated !== "number") return false;

  if (v.priceStats !== null) {
    if (!v.priceStats || typeof v.priceStats !== "object") return false;
    const ps = v.priceStats as Record<string, unknown>;
    if (
      typeof ps.min !== "number" ||
      typeof ps.max !== "number" ||
      typeof ps.avg !== "number" ||
      typeof ps.sampleCount !== "number" ||
      (ps.sensitivity !== "budget" && ps.sensitivity !== "mid" && ps.sensitivity !== "premium")
    ) {
      return false;
    }
  }

  return true;
}

function updateCategoryInterest(
  interests: CategoryInterest[],
  category: string,
  viewDuration = 0,
): CategoryInterest[] {
  const idx = interests.findIndex((x) => x.category === category);
  if (idx === -1) {
    return [
      ...interests,
      {
        category,
        score: 10,
        viewCount: 1,
        totalViewDuration: viewDuration,
        repeatViewCount: 0,
      },
    ];
  }

  const current = interests[idx]!;
  const next: CategoryInterest = {
    ...current,
    viewCount: current.viewCount + 1,
    totalViewDuration: current.totalViewDuration + viewDuration,
    repeatViewCount: current.repeatViewCount + 1,
    score: Math.min(100, current.score + 8),
  };

  return interests.map((item, i) => (i === idx ? next : item));
}

function updatePriceStats(current: PriceStatistics | null, price: number): PriceStatistics {
  if (!current) {
    return {
      min: price,
      max: price,
      avg: price,
      sampleCount: 1,
      sensitivity: price < 50 ? "budget" : price < 180 ? "mid" : "premium",
    };
  }

  const sampleCount = current.sampleCount + 1;
  const avg = (current.avg * current.sampleCount + price) / sampleCount;

  return {
    min: Math.min(current.min, price),
    max: Math.max(current.max, price),
    avg,
    sampleCount,
    sensitivity: avg < 50 ? "budget" : avg < 180 ? "mid" : "premium",
  };
}

function computeAbandonmentRisk(profile: BehavioralProfile): AbandonmentRisk {
  const now = Date.now();
  const inactivityMinutes = profile.cartLastUpdated
    ? (now - profile.cartLastUpdated) / 60000
    : 0;

  const cartInactivity = Math.min(100, inactivityMinutes * 2);
  const browseVsPurchase = Math.min(100, profile.engagement.totalEvents * 1.2);
  const priceSensitivity = profile.priceStats?.sensitivity === "budget" ? 60 : 30;
  const sessionEngagement = Math.max(0, 100 - profile.engagement.totalEvents * 3);

  const score = Math.round(
    cartInactivity * 0.3 +
      0 * 0.25 +
      browseVsPurchase * 0.2 +
      priceSensitivity * 0.15 +
      sessionEngagement * 0.1,
  );

  return {
    score,
    factors: {
      cartInactivity,
      idleBehavior: 0,
      browseVsPurchase,
      priceSensitivity,
      sessionEngagement,
    },
  };
}

export async function getProfile(sessionId: string): Promise<BehavioralProfile> {
  const raw = await redis.get(profileKey(sessionId));
  if (!raw) return defaultProfile(sessionId);

  try {
    const parsed = JSON.parse(raw);
    if (!isValidBehavioralProfile(parsed)) {
      return defaultProfile(sessionId);
    }

    if (typeof parsed.engagement.totalScrollEvents !== "number") {
      parsed.engagement.totalScrollEvents = 0;
    }

    return parsed;
  } catch {
    return defaultProfile(sessionId);
  }
}

export async function saveProfile(profile: BehavioralProfile): Promise<void> {
  await redis.set(profileKey(profile.sessionId), JSON.stringify(profile));
}

export async function updateProfileFromEvent(event: AppEvent): Promise<BehavioralProfile> {
  const profile = await getProfile(event.sessionId);

  const engagement: EngagementMetrics = {
    ...profile.engagement,
    totalScrollEvents: profile.engagement.totalScrollEvents ?? 0,
  };

  let next: BehavioralProfile = { ...profile, engagement, lastUpdated: Date.now() };

  switch (event.type) {
    case "page_view":
      next = {
        ...next,
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
        },
      };
      break;
    case "product_view":
      next = {
        ...next,
        interests: updateCategoryInterest(next.interests, event.category, event.viewDuration ?? 0),
        priceStats: updatePriceStats(next.priceStats, event.price),
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
          repeatViewCount: next.engagement.repeatViewCount + 1,
        },
      };
      break;
    case "search":
      next = {
        ...next,
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
          searchCount: next.engagement.searchCount + 1,
        },
      };
      break;
    case "add_to_cart":
      next = {
        ...next,
        cartLastUpdated: Date.now(),
        priceStats: updatePriceStats(next.priceStats, event.price),
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
        },
      };
      break;
    case "remove_from_cart":
      next = {
        ...next,
        cartLastUpdated: Date.now(),
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
        },
      };
      break;
    case "idle":
      if (event.idleDuration < MIN_ACTIVE_IDLE_MS) {
        next = {
          ...next,
          engagement: {
            ...next.engagement,
            totalEvents: next.engagement.totalEvents + 1,
          },
        };
      }
      break;
    case "click":
      next = {
        ...next,
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
          clickCount: next.engagement.clickCount + 1,
        },
      };
      break;
    case "scroll": {
      const scrollEvents = next.engagement.totalScrollEvents + 1;
      const avgScrollDepth =
        (next.engagement.avgScrollDepth * Math.max(0, scrollEvents - 1) + event.depth) / scrollEvents;

      next = {
        ...next,
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
          totalScrollEvents: scrollEvents,
          avgScrollDepth,
        },
      };
      break;
    }
    case "filter_change":
      next = {
        ...next,
        engagement: {
          ...next.engagement,
          totalEvents: next.engagement.totalEvents + 1,
          filterUsageCount: next.engagement.filterUsageCount + 1,
        },
      };
      break;
    default:
      break;
  }

  next = { ...next, abandonmentRisk: computeAbandonmentRisk(next) };
  await saveProfile(next);
  return next;
}
