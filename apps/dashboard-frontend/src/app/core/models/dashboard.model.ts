export interface KpiMetrics {
  followers: number;
  followersTrend: number;
  engagementRate: number;
  engagementTrend: number;
  dailyActiveUsers: number;
  dauTrend: number;
  apiCalls: number;
  apiTrendStatus: string;
}

export interface PostLeaderboard {
  id: string;
  time: string;
  snippet: string;
  impressions: number;
  hasMedia: boolean;
}

export interface UserLeaderboard {
  userId: string;
  interactions: number;
}
