export type BackstageMessageType = "capture" | "learn" | "decide" | "explain";

export interface CapturePayload {
  eventType: string;
  source: string;
  page?: string;
  element?: string;
  filter?: string;
  depth?: number;
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

export interface BackstagePayloadByType {
  capture: CapturePayload;
  learn: LearnPayload;
  decide: DecidePayload;
  explain: ExplainPayload;
}

export interface BackstageMessage<K extends BackstageMessageType = BackstageMessageType> {
  type: K;
  sessionId: string;
  timestamp: string;
  eventId: string;
  traceId: string;
  version: "v1";
  payload: BackstagePayloadByType[K];
}
