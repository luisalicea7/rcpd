import { redis } from "../config/redis.js";
import { getProfile } from "./profile-service.js";
import { logger } from "../utils/logger.js";
import {
  ActionType,
  type PersonalizationAction,
} from "../types/personalization.js";
import { listProductsByCategory } from "./product-service.js";
import { backstageManager } from "./backstage-manager.js";

const ACTIONS_KEY_PREFIX = "actions";
const ACTIONS_TTL_SECONDS = 60 * 60 * 24;
const MAX_ACTIONS = 3;

const ACTION_COOLDOWNS_MS: Record<
  Exclude<ActionType, ActionType.URGENCY_ALERT>,
  number
> = {
  [ActionType.CART_REMINDER]: 30 * 60 * 1000,
  [ActionType.DISCOUNT_BANNER]: 60 * 60 * 1000,
  [ActionType.CATEGORY_HIGHLIGHT]: 15 * 60 * 1000,
  [ActionType.PRODUCT_RECOMMENDATION]: 20 * 60 * 1000,
};

function actionsKey(sessionId: string): string {
  return `${ACTIONS_KEY_PREFIX}:${sessionId}`;
}

function now(): number {
  return Date.now();
}

function isPersonalizationAction(value: unknown): value is PersonalizationAction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  const validType = Object.values(ActionType).includes(v.type as ActionType);

  return (
    typeof v.id === "string" &&
    typeof v.sessionId === "string" &&
    validType &&
    v.payload !== null &&
    typeof v.payload === "object" &&
    typeof v.reasoning === "object" &&
    v.reasoning !== null &&
    typeof (v.reasoning as Record<string, unknown>).rule === "string" &&
    typeof (v.reasoning as Record<string, unknown>).triggerCondition === "string" &&
    typeof (v.reasoning as Record<string, unknown>).confidence === "number" &&
    typeof (v.reasoning as Record<string, unknown>).explanation === "string" &&
    typeof v.createdAt === "number" &&
    Number.isFinite(v.createdAt)
  );
}

async function getRecentActions(sessionId: string): Promise<PersonalizationAction[]> {
  try {
    const raw = await redis.get(actionsKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    if (!parsed.every((item) => isPersonalizationAction(item))) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function isInCooldown(
  actionType: Exclude<ActionType, ActionType.URGENCY_ALERT>,
  recent: PersonalizationAction[],
  nowTs: number,
): boolean {
  const last = recent
    .filter((a) => a.type === actionType)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!last) return false;
  return nowTs - last.createdAt < ACTION_COOLDOWNS_MS[actionType];
}

function dedupeByType(actions: PersonalizationAction[]): PersonalizationAction[] {
  const seen = new Set<ActionType>();
  const result: PersonalizationAction[] = [];

  for (const action of actions) {
    if (seen.has(action.type)) continue;
    seen.add(action.type);
    result.push(action);
  }

  return result;
}

function applyConflictRules(actions: PersonalizationAction[]): PersonalizationAction[] {
  const discountAction = actions.find((a) => a.type === ActionType.DISCOUNT_BANNER);
  const cartReminderAction = actions.find((a) => a.type === ActionType.CART_REMINDER);

  if (!discountAction || !cartReminderAction) {
    return actions;
  }

  const loserType =
    discountAction.reasoning.confidence >= cartReminderAction.reasoning.confidence
      ? ActionType.CART_REMINDER
      : ActionType.DISCOUNT_BANNER;

  return actions.filter((a) => a.type !== loserType);
}

export async function getPersonalization(sessionId: string): Promise<{
  sessionId: string;
  generatedAt: number;
  actions: PersonalizationAction[];
}> {
  const profile = await getProfile(sessionId);
  const currentTs = now();
  const recentActions = await getRecentActions(sessionId);
  const actions: PersonalizationAction[] = [];

  if (
    profile.abandonmentRisk.score >= 55 &&
    profile.cartLastUpdated &&
    !isInCooldown(ActionType.CART_REMINDER, recentActions, currentTs)
  ) {
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
      createdAt: currentTs,
    });
  }

  const topInterest = profile.interests
    .slice()
    .sort((a, b) => b.score - a.score)[0];

  if (
    topInterest &&
    topInterest.score >= 20 &&
    !isInCooldown(ActionType.CATEGORY_HIGHLIGHT, recentActions, currentTs)
  ) {
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
      createdAt: currentTs,
    });
  }

  if (
    topInterest &&
    topInterest.score >= 20 &&
    !isInCooldown(ActionType.PRODUCT_RECOMMENDATION, recentActions, currentTs)
  ) {
    const candidates = listProductsByCategory(topInterest.category, 3).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
    }));

    if (candidates.length > 0) {
      actions.push({
        id: `act_${sessionId}_rec_${topInterest.category}`,
        sessionId,
        type: ActionType.PRODUCT_RECOMMENDATION,
        payload: { category: topInterest.category, products: candidates },
        reasoning: {
          rule: "category_recommendation_from_interest",
          triggerCondition: "top category score >= 20",
          confidence: Math.min(88, topInterest.score + 8),
          explanation: "Recommending products from the strongest interest category.",
        },
        createdAt: currentTs,
      });
    }
  }

  if (
    profile.priceStats?.sensitivity === "budget" &&
    profile.engagement.totalEvents >= 6 &&
    !isInCooldown(ActionType.DISCOUNT_BANNER, recentActions, currentTs)
  ) {
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
      createdAt: currentTs,
    });
  }

  const ranked = applyConflictRules(
    dedupeByType(actions.sort((a, b) => b.reasoning.confidence - a.reasoning.confidence)),
  ).slice(0, MAX_ACTIONS);

  const traceId = `pers_${sessionId}_${currentTs}`;
  for (const action of ranked) {
    backstageManager.emit("decide", {
      sessionId,
      eventId: action.id,
      traceId,
      payload: {
        ruleId: action.reasoning.rule,
        matched: true,
        confidence: Number((action.reasoning.confidence / 100).toFixed(2)),
        actionType: action.type,
      },
    });

    backstageManager.emit("explain", {
      sessionId,
      eventId: action.id,
      traceId,
      payload: {
        title: `${action.type} triggered`,
        reason: action.reasoning.triggerCondition,
        humanText: action.reasoning.explanation,
        action: {
          id: action.id,
          type: action.type,
          params: action.payload,
        },
      },
    });
  }

  const key = actionsKey(sessionId);
  try {
    await redis.set(key, JSON.stringify(ranked), "EX", ACTIONS_TTL_SECONDS);
  } catch (err) {
    logger.error(
      { err, sessionId, key, ttlSeconds: ACTIONS_TTL_SECONDS },
      "Failed to cache personalization actions",
    );
  }

  return {
    sessionId,
    generatedAt: currentTs,
    actions: ranked,
  };
}
