export type Act = 'idle' | 'thinking' | 'tool' | 'writing' | 'reading' | 'delegating' | 'waiting' | 'compacting' | 'responding' | 'error' | 'aborted' | 'sleep'

export type TurnRecord = {
  at: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  ms?: number
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Sample = { t: number; p: number; resetsAt?: string }

export type Meter = {
  context: { tokens?: number; window: number; percent?: number; autoCompact?: boolean } | null
  rateLimits: Limit[]
  cost: number | null
  base: Record<string, Sample>
}

export type Tally = { input: number; output: number; write5m: number; write1h: number; read: number; calls: number }

export type DayTally = Tally & { day: string; model: string }

export type Ledger = { at: number | null; rows: DayTally[]; loading: boolean; error?: string }

export type Range = 'month' | 'all'

declare module 'claude-code' {
  interface PluginState {
    'clawd-hud': { meter: Meter; last: TurnRecord | null; act: Act; helpers: number; chores: number; ledger: Ledger; range: Range }
  }
}
