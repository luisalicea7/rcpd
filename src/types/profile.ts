export interface CategoryInterest {
  category: string;
  score: number; // 0–100
  viewCount: number;
  totalViewDuration: number; // ms
  repeatViewCount: number;
}

export interface PriceStatistics {
  min: number;
  max: number;
  avg: number;
  sensitivity: "budget" | "mid" | "premium";
}

export interface EngagementMetrics {
  totalEvents: number;
  avgScrollDepth: number; // 0–100
  clickCount: number;
  filterUsageCount: number;
  searchCount: number;
  repeatViewCount: number;
}

export interface AbandonmentRisk {
  score: number; // 0–100 composite
  factors: {
    cartInactivity: number; // weight 0.30
    idleBehavior: number; // weight 0.25
    browseVsPurchase: number; // weight 0.20
    priceSensitivity: number; // weight 0.15
    sessionEngagement: number; // weight 0.10 (inverted: low engagement = high risk)
  };
}

export interface BehavioralProfile {
  sessionId: string;
  interests: CategoryInterest[];
  priceStats: PriceStatistics | null;
  engagement: EngagementMetrics;
  abandonmentRisk: AbandonmentRisk;
  cartLastUpdated: number | null;
  lastUpdated: number;
}