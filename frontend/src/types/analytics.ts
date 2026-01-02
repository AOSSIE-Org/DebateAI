export type DebateAnalytics = {
  totalArguments: number
  totalDurationSeconds: number
  avgResponseTimeSecs: number
  totalRebuttals: number
  avgArgumentLength: number
}

export type RecentDebate = {
  id: string
  topic: string
  result: string
  opponent: string
  debateType: string
  date: string
  analytics?: DebateAnalytics
}

export type UserAnalyticsResponse = {
  totalDebates: number
  wins: number
  losses: number
  draws: number
  winRate: number
  recentDebates?: RecentDebate[]
  avgArgumentsPerDebate?: number
  avgResponseTimeSecs?: number
}
