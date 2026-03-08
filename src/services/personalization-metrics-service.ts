import { redis } from "../config/redis.js";
import { ActionType, type PersonalizationAction } from "../types/personalization.js";

const ACTIONS_KEY_PATTERN = "actions:*";
const SCAN_COUNT = 200;

function isAction(value: unknown): value is PersonalizationAction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const confidence = (v.reasoning as Record<string, unknown> | null)?.confidence;

  return (
    typeof v.type === "string" &&
    Object.values(ActionType).includes(v.type as ActionType) &&
    typeof v.createdAt === "number" &&
    Number.isFinite(v.createdAt) &&
    v.reasoning !== null &&
    typeof v.reasoning === "object" &&
    typeof confidence === "number" &&
    Number.isFinite(confidence)
  );
}

export async function getPersonalizationMetrics(): Promise<{
  generatedAt: number;
  windowHours: number;
  sessionsWithActions: number;
  totalActions24h: number;
  avgConfidence: number;
  countsByType: Record<string, number>;
}> {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  const countsByType: Record<string, number> = {
    [ActionType.CART_REMINDER]: 0,
    [ActionType.CATEGORY_HIGHLIGHT]: 0,
    [ActionType.DISCOUNT_BANNER]: 0,
    [ActionType.PRODUCT_RECOMMENDATION]: 0,
    [ActionType.URGENCY_ALERT]: 0,
  };

  let sessionsWithActions = 0;
  let totalActions = 0;
  let confidenceSum = 0;

  const processedKeys = new Set<string>();
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      ACTIONS_KEY_PATTERN,
      "COUNT",
      SCAN_COUNT,
    );

    cursor = nextCursor;

    if (keys.length === 0) continue;

    const uniqueKeys = Array.from(new Set(keys)).filter((key) => !processedKeys.has(key));
    if (uniqueKeys.length === 0) continue;

    for (const key of uniqueKeys) processedKeys.add(key);

    const values = await redis.mget(...uniqueKeys);
    for (const raw of values) {
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      if (!Array.isArray(parsed)) continue;

      const actions = parsed.filter(isAction).filter((a) => a.createdAt >= cutoff);
      if (actions.length === 0) continue;

      sessionsWithActions += 1;

      for (const action of actions) {
        totalActions += 1;
        confidenceSum += action.reasoning.confidence;
        countsByType[action.type] = (countsByType[action.type] ?? 0) + 1;
      }
    }
  } while (cursor !== "0");

  return {
    generatedAt: now,
    windowHours: 24,
    sessionsWithActions,
    totalActions24h: totalActions,
    avgConfidence: totalActions > 0 ? Number((confidenceSum / totalActions).toFixed(2)) : 0,
    countsByType,
  };
}
