import { redis } from "../config/redis.js";
import { getProfile } from "./profile-service.js";
import {
  ActionType,
  type PersonalizationAction,
} from "../types/personalization.js";

const ACTIONS_KEY_PREFIX = "actions";
const ACTIONS_TTL_SECONDS = 60 * 60 * 24;
const MAX_ACTIONS = 3;

function actionsKey(sessionId: string): string {
  return `${ACTIONS_KEY_PREFIX}:${sessionId}`;
}

function now(): number {
  return Date.now();
}

export async function getPersonalization(sessionId: string): Promise<{
  sessionId: string;
  generatedAt: number;
  actions: PersonalizationAction[];
}> {
  const profile = await getProfile(sessionId);
  const actions: PersonalizationAction[] = [];

  if (profile.abandonmentRisk.score >= 55 && profile.cartLastUpdated) {
    actions.push({
      id: `act_${sessionId}_cart_reminder`,
      sessionId,
      type: ActionType.CART_REMINDER,
      payload: { message: "Still thinking it over?" },
      reasoning: {
        rule: "cart_inactivity_high_risk",
        triggerCondition: "abandonmentRisk>=55 and cartLastUpdated exists",
        confidence: Math.min(95, profile.abandonmentRisk.score),
        explanation: "High abandonment risk with recent cart activity.",
      },
      createdAt: now(),
    });
  }

  const topInterest = profile.interests
    .slice()
    .sort((a, b) => b.score - a.score)[0];

  if (topInterest && topInterest.score >= 20) {
    actions.push({
      id: `act_${sessionId}_category_${topInterest.category}`,
      sessionId,
      type: ActionType.CATEGORY_HIGHLIGHT,
      payload: { category: topInterest.category },
      reasoning: {
        rule: "top_interest_category",
        triggerCondition: "top category score >= 20",
        confidence: Math.min(90, topInterest.score + 10),
        explanation: "Highlighting the category with highest recent engagement.",
      },
      createdAt: now(),
    });
  }

  if (profile.priceStats?.sensitivity === "budget" && profile.engagement.totalEvents >= 6) {
    actions.push({
      id: `act_${sessionId}_discount_banner`,
      sessionId,
      type: ActionType.DISCOUNT_BANNER,
      payload: { percent: 10, code: "SAVE10" },
      reasoning: {
        rule: "budget_user_high_activity",
        triggerCondition: "budget sensitivity and totalEvents>=6",
        confidence: 72,
        explanation: "Budget-sensitive active user likely to respond to a modest discount.",
      },
      createdAt: now(),
    });
  }

  const ranked = actions
    .sort((a, b) => b.reasoning.confidence - a.reasoning.confidence)
    .slice(0, MAX_ACTIONS);

  await redis.set(actionsKey(sessionId), JSON.stringify(ranked), "EX", ACTIONS_TTL_SECONDS);

  return {
    sessionId,
    generatedAt: now(),
    actions: ranked,
  };
}
