export type BackstageMessageType = "capture" | "learn" | "decide" | "explain";

export interface BackstageMessage<TPayload = Record<string, unknown>> {
  type: BackstageMessageType;
  sessionId: string;
  timestamp: string;
  eventId: string;
  traceId: string;
  version: "v1";
  payload: TPayload;
}

export interface CapturePayload {
  eventType: string;
  source: string;
  productId?: string;
  category?: string;
  price?: number;
}

export interface LearnPayload {
  profileDelta: {
    topCategory?: string;
    interestScoreDelta?: number;
    newInterestScore?: number;
    avgViewedPrice?: number;
    abandonmentRisk: number;
  };
}

export interface DecidePayload {
  ruleId: string;
  matched: boolean;
  confidence: number;
  actionType: string;
}

export interface ExplainPayload {
  title: string;
  reason: string;
  humanText: string;
  action: {
    id: string;
    type: string;
    params: Record<string, unknown>;
  };
}
