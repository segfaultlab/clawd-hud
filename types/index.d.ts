export type Live = { out: number; est: number }

export type Act = 'idle' | 'thinking' | 'tool' | 'responding' | 'error' | 'aborted' | 'sleep'

export type TurnRecord = {
  at: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Sample = { t: number; p: number; resetsAt?: string }

export type Meter = {
  context: { tokens?: number; window: number; percent?: number } | null
  rateLimits: Limit[]
  base: Record<string, Sample>
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-hud': { live: Live | null; meter: Meter; last: TurnRecord | null; act: Act }
  }
}
