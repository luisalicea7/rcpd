import { redis } from "../config/redis.js";
import type { AppEvent } from "../types/events.js";
import type {
  AbandonmentRisk,
  BehavioralProfile,
  CategoryInterest,
  EngagementMetrics,
  PriceStatistics,
} from "../types/profile.js";

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
      sensitivity: price < 50 ? "budget" : price < 180 ? "mid" : "premium",
    };
  }

  const avg = (current.avg + price) / 2;
  return {
    min: Math.min(current.min, price),
    max: Math.max(current.max, price),
    avg,
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
    return JSON.parse(raw) as BehavioralProfile;
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
    totalEvents: profile.engagement.totalEvents + 1,
  };

  let next: BehavioralProfile = { ...profile, engagement, lastUpdated: Date.now() };

  switch (event.type) {
    case "product_view":
      next = {
        ...next,
        interests: updateCategoryInterest(next.interests, event.category, event.viewDuration ?? 0),
        priceStats: updatePriceStats(next.priceStats, event.price),
        engagement: {
          ...next.engagement,
          repeatViewCount: next.engagement.repeatViewCount + 1,
        },
      };
      break;
    case "search":
      next = {
        ...next,
        engagement: {
          ...next.engagement,
          searchCount: next.engagement.searchCount + 1,
        },
      };
      break;
    case "add_to_cart":
      next = {
        ...next,
        cartLastUpdated: Date.now(),
        priceStats: updatePriceStats(next.priceStats, event.price),
      };
      break;
    case "remove_from_cart":
      next = {
        ...next,
        cartLastUpdated: Date.now(),
      };
      break;
    default:
      break;
  }

  next = { ...next, abandonmentRisk: computeAbandonmentRisk(next) };
  await saveProfile(next);
  return next;
}
