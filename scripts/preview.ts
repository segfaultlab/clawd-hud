import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Act, Meter, TurnRecord } from '../types/index.d.ts'
import { bandParts, type Drawing } from '../hooks/draw.ts'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')
const now = Date.parse('2026-10-05T12:00:00Z')
const iso = (ms: number) => new Date(now + ms).toISOString()

const meter = (five: number): Meter => ({
  context: { window: 200000, tokens: 68000, percent: 34 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: five, resetsAt: iso(2 * 3600000) },
    { kind: 'seven_day', percentUsed: 41, resetsAt: iso(3 * 86400000) },
  ],
  cost: 3.27,
  base: { five_hour: { t: now - 90 * 60000, p: five - 22 } },
})

const last: TurnRecord = { at: now - 60000, input: 1200, output: 3400, cacheRead: 98000, cacheWrite: 2000, ms: 47000 }

const BG = `<style>.bg{fill:#f0efea}@media (prefers-color-scheme:dark){.bg{fill:#262624}}.cap{font:12px ui-monospace,"SF Mono",Menlo,monospace;fill:#898781}</style>`

const place = (d: Drawing, x: number, y: number, keepStyle: boolean) => {
  const body = keepStyle ? d.source : d.source.replace(/<style>[\s\S]*?<\/style>/, '')
  return body.replace('<svg xmlns="http://www.w3.org/2000/svg" ', `<svg x="${x}" y="${y}" `)
}

const page = (w: number, h: number, inner: string, zoom = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * zoom}" height="${h * zoom}" viewBox="0 0 ${w} ${h}">${BG}<rect class="bg" width="${w}" height="${h}" rx="12"/>${inner}</svg>\n`

const band = () => {
  const parts = bandParts(meter(62), last, now, false, 'idle', 0, 0)
  const gap = 18
  const pad = 16
  const h = 56
  let x = pad
  const inner = parts.map((p, i) => {
    const s = place(p, x, (h - p.height) / 2, i === 0)
    x += p.width + gap
    return s
  })
  return page(Math.ceil(x - gap + pad), h, inner.join(''))
}

const POSES: { label: string; act: Act; working?: boolean; five?: number; helpers?: number; chores?: number; done?: boolean }[] = [
  { label: '思考', act: 'thinking', working: true },
  { label: '调工具', act: 'tool', working: true },
  { label: '写文件', act: 'writing', working: true },
  { label: '读文件', act: 'reading', working: true },
  { label: '写回复', act: 'responding', working: true },
  { label: '等你批准', act: 'waiting' },
  { label: '压缩上下文', act: 'compacting' },
  { label: '子代理', act: 'delegating', working: true, helpers: 1 },
  { label: '后台命令', act: 'idle', chores: 1 },
  { label: '完成', act: 'idle', done: true },
  { label: '出错', act: 'error' },
  { label: '中断', act: 'aborted' },
  { label: '睡觉', act: 'sleep' },
  { label: '额度紧张', act: 'thinking', working: true, five: 92 },
  { label: '额度用完', act: 'idle', five: 100 },
]

const poses = () => {
  const cols = 5
  const cw = 104
  const ch = 76
  const pad = 12
  const inner = POSES.map((p, i) => {
    const d = bandParts(meter(p.five ?? 30), p.done ? { ...last, at: now } : last, now, !!p.working, p.act, p.helpers ?? 0, p.chores ?? 0)[0]!
    const x = pad + (i % cols) * cw
    const y = pad + Math.floor(i / cols) * ch
    return `${place(d, x + (cw - d.width) / 2, y, i === 0)}<text class="cap" x="${x + cw / 2}" y="${y + 58}" text-anchor="middle">${p.label}</text>`
  })
  return page(pad * 2 + cols * cw, pad * 2 + Math.ceil(POSES.length / cols) * ch - 8, inner.join(''), 2)
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'band.svg'), band())
writeFileSync(join(out, 'poses.svg'), poses())
