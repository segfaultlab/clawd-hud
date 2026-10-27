import type { DayTally, Tally } from '../types'

export const SCAN = `find . -name '*.jsonl' -exec grep -h -F '"usage"' {} + | grep -o -n -E '"model":"[^"]*","id":"[^"]*"|"requestId":"[^"]*"|"timestamp":"[^"]*"|"(input_tokens|output_tokens|cache_read_input_tokens|cache_creation_input_tokens|ephemeral_1h_input_tokens|ephemeral_5m_input_tokens)":[0-9]+'`

const PRICES: Record<string, [number, number, number]> = {
  'claude-fable-5-1': [10, 50, 0.25],
  'claude-fable-5': [10, 50, 1],
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-opus-5': [5, 25, 0.5],
  'claude-opus-4-8': [5, 25, 0.5],
  'claude-opus-4-7': [5, 25, 0.5],
  'claude-opus-4-6': [5, 25, 0.5],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-sonnet-5': [2, 10, 0.2],
  'claude-sonnet-4-6': [3, 15, 0.3],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
  'claude-haiku-4-5': [1, 5, 0.1],
}

export const priceOf = (model: string, t: Tally): number | null => {
  const p = PRICES[model]
  if (!p) return null
  const [i, o, r] = p
  return (t.input * i + t.output * o + t.write5m * i * 1.25 + t.write1h * i * 2 + t.read * r) / 1e6
}

export const emptyTally = (): Tally => ({ input: 0, output: 0, write5m: 0, write1h: 0, read: 0, calls: 0 })

const addTally = (a: Tally, b: Tally) => {
  a.input += b.input
  a.output += b.output
  a.write5m += b.write5m
  a.write1h += b.write1h
  a.read += b.read
  a.calls += b.calls
}

export const tokensOf = (t: Tally) => t.input + t.output + t.write5m + t.write1h + t.read

export const localDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const FIELD = /^(\d+):"(\w+)":(?:"([^"]*)"(?:,"id":"([^"]*)")?|(\d+))$/

type Entry = { model?: string; id?: string; requestId?: string; timestamp?: string; nums: Record<string, number> }

export const tallyScan = (text: string): DayTally[] => {
  const seen = new Set<string>()
  const byKey = new Map<string, DayTally>()
  const flush = (e: Entry | null) => {
    if (!e?.model || e.model === '<synthetic>' || !e.timestamp || e.nums.output_tokens === undefined) return
    const key = `${e.id}|${e.requestId}`
    if (seen.has(key)) return
    seen.add(key)
    const ms = Date.parse(e.timestamp)
    if (Number.isNaN(ms)) return
    const n = e.nums
    const split = n.ephemeral_1h_input_tokens !== undefined || n.ephemeral_5m_input_tokens !== undefined
    const t: Tally = {
      input: n.input_tokens ?? 0,
      output: n.output_tokens ?? 0,
      write5m: split ? (n.ephemeral_5m_input_tokens ?? 0) : (n.cache_creation_input_tokens ?? 0),
      write1h: split ? (n.ephemeral_1h_input_tokens ?? 0) : 0,
      read: n.cache_read_input_tokens ?? 0,
      calls: 1,
    }
    const day = localDay(ms)
    const k = `${day}|${e.model}`
    const row = byKey.get(k) ?? { day, model: e.model, ...emptyTally() }
    addTally(row, t)
    byKey.set(k, row)
  }
  let line = ''
  let cur: Entry | null = null
  for (const raw of text.split('\n')) {
    const m = FIELD.exec(raw)
    if (!m) continue
    const [, no, key, str, id, num] = m
    if (no !== line) {
      flush(cur)
      line = no!
      cur = { nums: {} }
    }
    const e = cur!
    if (key === 'model') {
      if (e.model === undefined) {
        e.model = str
        e.id = id
      }
    } else if (key === 'requestId') e.requestId = str
    else if (key === 'timestamp') e.timestamp = str
    else if (num !== undefined && e.nums[key!] === undefined) e.nums[key!] = Number(num)
  }
  flush(cur)
  return [...byKey.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export type ModelLine = { model: string; tally: Tally; cost: number | null }

export type Summary = { models: ModelLine[]; total: Tally; cost: number; unpriced: boolean; daily: { day: string; cost: number; tokens: number }[] }

export const summarize = (rows: DayTally[], from: string | null, today: string): Summary => {
  const picked = rows.filter(r => (from === null || r.day >= from) && r.day <= today)
  const models = new Map<string, Tally>()
  const days = new Map<string, { cost: number; tokens: number }>()
  for (const r of picked) {
    const t = models.get(r.model) ?? emptyTally()
    addTally(t, r)
    models.set(r.model, t)
    const d = days.get(r.day) ?? { cost: 0, tokens: 0 }
    d.cost += priceOf(r.model, r) ?? 0
    d.tokens += tokensOf(r)
    days.set(r.day, d)
  }
  const lines = [...models].map(([model, tally]) => ({ model, tally, cost: priceOf(model, tally) })).sort((a, b) => tokensOf(b.tally) - tokensOf(a.tally))
  const total = emptyTally()
  for (const l of lines) addTally(total, l.tally)
  const start = from ?? picked[0]?.day ?? today
  const daily: Summary['daily'] = []
  for (let ms = Date.parse(`${start}T12:00:00`); localDay(ms) <= today; ms += 86400000) {
    const day = localDay(ms)
    daily.push({ day, ...(days.get(day) ?? { cost: 0, tokens: 0 }) })
  }
  return { models: lines, total, cost: lines.reduce((s, l) => s + (l.cost ?? 0), 0), unpriced: lines.some(l => l.cost === null), daily }
}
