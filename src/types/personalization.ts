export enum ActionType {
  DISCOUNT_BANNER = "discount_banner",
  CART_REMINDER = "cart_reminder",
  PRODUCT_RECOMMENDATION = "product_recommendation",
  URGENCY_ALERT = "urgency_alert",
  CATEGORY_HIGHLIGHT = "category_highlight",
}

export interface ActionReasoning {
  rule: string;
  triggerCondition: string;
  confidence: number; // 0–100
  explanation: string;
}

export interface PersonalizationAction {
  id: string;
  sessionId: string;
  type: ActionType;
  payload: Record<string, unknown>;
  reasoning: ActionReasoning;
  createdAt: number;
}