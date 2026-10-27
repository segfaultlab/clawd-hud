import type { Act, Limit, Meter, TurnRecord } from '../types'

export const fmt = (n: number) =>
  n < 1000 ? `${n}` : n < 1e6 ? `${(n / 1000).toFixed(1)}k` : n < 1e9 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e9).toFixed(2)}B`

const span = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const dur = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m${s % 60}s` : span(ms)
}

export const usd = (n: number) => (n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`)

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'wk',
  spend_limit: 'spend',
}

export const limitName = (l: Limit) => LIMIT_NAMES[l.kind] ?? l.kind

export type Drawing = { source: string; width: number; height: number; alt: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const textWidth = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (/[⺀-￿]/.test(ch) ? size : size * 0.6), 0)

const CLAWD = '#D77757'

const STYLE = `<style>
svg{--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--grid:#d6d5ce;--track:rgba(11,11,11,.09);
--s1:#2a78d6;--s4:#eda100;--good:#0ca30c;--warn:#e09a00;--crit:#d03b3b;--goodt:#006300;--warnt:#9a6a00;
font-family:ui-monospace,"SF Mono",Menlo,monospace}
@media (prefers-color-scheme:dark){svg{--ink:#fff;--ink2:#c3c2b7;--grid:#383835;--track:rgba(255,255,255,.10);
--s1:#3987e5;--s4:#c98500;--warn:#fab219;--goodt:#0ca30c;--warnt:#fab219}}
text{fill:var(--ink)}.t2{fill:var(--ink2)}.mu{fill:var(--muted)}.v{font-size:13px;font-weight:700}
.good{fill:var(--goodt)}.warn{fill:var(--warnt)}.crit{fill:var(--crit)}
.pop{opacity:0;animation:pop 1ms linear forwards}@keyframes pop{to{opacity:1}}
.bc{animation:bc 1s steps(1) infinite}@keyframes bc{50%{opacity:.2}}
.bob{animation:bob 1.2s steps(1) infinite}.walk{animation:bob .32s steps(1) infinite}
@keyframes bob{50%{transform:translateY(calc(var(--u) * -1))}}
.legA{animation:legA .32s steps(1) infinite}@keyframes legA{50%{opacity:0}}
.legB{animation:legB .32s steps(1) infinite}@keyframes legB{0%{opacity:0}50%{opacity:1}}
.blink{opacity:0;animation:blink 4s steps(1) infinite}@keyframes blink{0%{opacity:0}92%{opacity:1}96%{opacity:0}}
.sweat{animation:sweat 1.6s steps(4) infinite}@keyframes sweat{0%,25%{transform:none;opacity:1}100%{transform:translateY(calc(var(--u) * 3));opacity:0}}
.kickA{animation:legA .6s steps(1) infinite}.kickB{animation:legB .6s steps(1) infinite}
.zz{opacity:0;animation:zz 2.4s steps(6) infinite}@keyframes zz{0%{opacity:0;transform:none}15%{opacity:1}100%{opacity:0;transform:translate(calc(var(--u) * 3),calc(var(--u) * -4))}}
.jump{animation:jump .5s steps(3) 3,bob 1.2s steps(1) 1.5s infinite}@keyframes jump{50%{transform:translateY(calc(var(--u) * -3))}}
.spark{transform-box:fill-box;transform-origin:center;opacity:0;animation:spark .8s steps(4) 2}
@keyframes spark{0%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.4)}}
.shake{animation:shake .2s steps(1) infinite}@keyframes shake{50%{transform:translateX(calc(var(--u) * .5))}}
.glint{opacity:0;animation:glint 3.5s steps(var(--n)) infinite}
@keyframes glint{0%{opacity:.55;transform:none}40%{opacity:.55;transform:translateX(var(--d))}41%,100%{opacity:0;transform:translateX(var(--d))}}
.tw{transform-box:fill-box;transform-origin:center;animation:tw 1.6s steps(2) infinite}@keyframes tw{50%{transform:scale(.4);opacity:.5}}
.think{animation:bob 2s steps(1) infinite}
.q{animation:q 1.4s steps(1) infinite}@keyframes q{50%{transform:translateY(calc(var(--u) * -1))}}
.hamA{animation:legA .5s steps(1) infinite}.hamB{animation:legB .5s steps(1) infinite}
.ch{opacity:0;animation:ch 1.2s steps(4) infinite}@keyframes ch{0%{opacity:1;transform:none}100%{opacity:0;transform:translate(var(--u),calc(var(--u) * -5))}}
.sway{animation:sway 1.2s steps(1) infinite}@keyframes sway{50%{transform:translateX(calc(var(--u) * .5))}}
.orbit{animation:orbit 1.2s steps(1) infinite}
@keyframes orbit{0%{transform:none}25%{transform:translate(calc(var(--u) * 3),var(--u))}50%{transform:translate(calc(var(--u) * 6),0px)}75%{transform:translate(calc(var(--u) * 3),calc(var(--u) * -1))}}
.fall{transform-box:fill-box;transform-origin:bottom;animation:fall 1.4s steps(4) 1}
@keyframes fall{0%{transform:none}15%,65%{transform:scaleY(.55)}100%{transform:none}}
.bang{opacity:0;animation:bang 1.6s steps(1) 1}@keyframes bang{0%,70%{opacity:1}100%{opacity:0}}
.penx{animation:penx 2s steps(4) infinite}@keyframes penx{0%{transform:none}80%,100%{transform:translateX(calc(var(--u) * 4))}}
.ink{transform-box:fill-box;transform-origin:left;animation:ink 2s steps(4) infinite}@keyframes ink{0%{transform:scaleX(0)}80%,100%{transform:scaleX(1)}}
.scrib{animation:bob .16s steps(1) infinite}
.flip{transform-box:fill-box;transform-origin:calc(var(--u) * -.5) 0;opacity:0;animation:flip 3s steps(1) infinite}
@keyframes flip{0%,70%{opacity:0;transform:none}72%{opacity:1;transform:none}80%{opacity:1;transform:scaleX(.4)}88%{opacity:1;transform:scaleX(-.4)}96%{opacity:1;transform:scaleX(-1)}100%{opacity:0;transform:scaleX(-1)}}
.wave{animation:wave .4s steps(1) infinite}@keyframes wave{50%{transform:translateX(var(--u))}}
.dot{opacity:.25;animation:dot 1.2s steps(1) infinite}@keyframes dot{0%,40%{opacity:1}41%,100%{opacity:.25}}
.squash{transform-box:fill-box;transform-origin:bottom;animation:breathe .6s steps(2) infinite}
.crush{transform-box:fill-box;transform-origin:center;animation:crush 1.5s steps(3) infinite}@keyframes crush{to{transform:scale(.3)}}
.breathe{transform-box:fill-box;transform-origin:bottom;animation:breathe 2.4s steps(2) infinite}@keyframes breathe{50%{transform:scaleY(.88)}}
</style>`

const cellsPath = (cells: readonly (readonly [number, number])[], x: number, y: number, w: number, h: number) =>
  cells.map(([cx, cy]) => `M${x + cx * w} ${y + cy * h}h${w}v${h}h${-w}z`).join('')

const BODY: [number, number][] = []
for (let cx = 3; cx <= 14; cx++) BODY.push([cx, 0])
for (let cx = 3; cx <= 14; cx++) if (cx !== 5 && cx !== 12) BODY.push([cx, 1])
for (let cx = 1; cx <= 16; cx++) BODY.push([cx, 2])
for (let cx = 3; cx <= 14; cx++) BODY.push([cx, 3])
const EYES: [number, number][] = [[5, 1], [12, 1]]
const LEGS_A: [number, number][] = [[4, 4], [6, 4], [11, 4], [13, 4]]
const LEGS_B: [number, number][] = [[5, 4], [7, 4], [10, 4], [12, 4]]

type Pose = { mode: Act | 'flat'; level: number; celebrate: boolean }

const flip = (cells: [number, number][]) => cells.map(([cx, cy]) => [cx, 4 - cy] as [number, number])

const glyphCells = (rows: string[]) => {
  const cells: [number, number][] = []
  rows.forEach((row, ry) => [...row].forEach((bit, rx) => bit === '1' && cells.push([rx, ry])))
  return cells
}

const Z = glyphCells(['111', '001', '010', '100', '111'])
const Q = glyphCells(['111', '001', '011', '000', '010'])
const BANG = glyphCells(['1', '1', '1', '0', '1'])
const DROP = glyphCells(['00100', '00100', '01110', '11111', '11111', '11111', '01110'])

const zzz = (u: number) =>
  [0, 0.8, 1.6]
    .map((d, i) => `<path class="zz" style="animation-delay:${d}s" d="${cellsPath(Z, 16 * u + i * u, -u - i * u, u * 0.8, u * 0.8)}" fill="var(--ink2)"/>`)
    .join('')

const extras = (mode: Pose['mode'], u: number) => {
  if (mode === 'thinking') {
    return `<path class="q" d="${cellsPath(Q, 15 * u, -4 * u, u * 0.8, u * 0.8)}" fill="var(--ink2)"/>`
  }
  if (mode === 'tool') {
    return `<g class="hamA"><rect x="${17 * u}" y="${-2 * u}" width="${u}" height="${6 * u}" fill="#8a5a3c"/><rect x="${16 * u}" y="${-4 * u}" width="${3 * u}" height="${2 * u}" fill="var(--muted)"/></g>
<g class="hamB"><rect x="${17 * u}" y="${3 * u}" width="${5 * u}" height="${u}" fill="#8a5a3c"/><rect x="${21 * u}" y="${u}" width="${2 * u}" height="${4 * u}" fill="var(--muted)"/><rect x="${24 * u}" y="0" width="${u}" height="${u}" fill="var(--s4)"/><rect x="${24 * u}" y="${5 * u}" width="${u}" height="${u}" fill="var(--s4)"/></g>`
  }
  if (mode === 'writing') {
    return `<rect x="${18 * u}" y="${6 * u}" width="${6 * u}" height="${4 * u}" fill="var(--grid)"/><rect class="ink" x="${19 * u}" y="${8 * u}" width="${4 * u}" height="${u}" fill="var(--ink2)"/>
<g class="penx"><g class="scrib"><rect x="${19 * u}" y="${8 * u}" width="${u}" height="${u}" fill="var(--ink2)"/><path d="${cellsPath([[20, 7], [21, 6]], 0, 0, u, u)}" fill="var(--s4)"/><rect x="${22 * u}" y="${5 * u}" width="${u}" height="${u}" fill="var(--crit)"/></g></g>`
  }
  if (mode === 'reading') {
    const lines = [18.5, 22.5].flatMap(px => [4, 6].map(py => `<rect x="${px * u}" y="${py * u}" width="${2 * u}" height="${u / 2}" fill="var(--muted)"/>`)).join('')
    return `<rect x="${17 * u}" y="${4 * u}" width="${9 * u}" height="${5 * u}" fill="var(--s1)"/><rect x="${18 * u}" y="${3 * u}" width="${3 * u}" height="${5 * u}" fill="#f4f1e8"/><rect x="${22 * u}" y="${3 * u}" width="${3 * u}" height="${5 * u}" fill="#f4f1e8"/>${lines}<rect class="flip" x="${22 * u}" y="${3 * u}" width="${3 * u}" height="${5 * u}" fill="#e2ddcf"/>`
  }
  if (mode === 'waiting') {
    const dots = [20, 22, 24].map((dx, i) => `<rect class="dot" style="animation-delay:${i * 0.4}s" x="${dx * u}" y="${-3 * u}" width="${u}" height="${u}" fill="var(--ink2)"/>`).join('')
    return `<rect x="${17 * u}" y="${-u}" width="${u}" height="${7 * u}"/><g class="wave"><rect x="${16 * u}" y="${-2 * u}" width="${u}" height="${u}"/><rect x="${18 * u}" y="${-2 * u}" width="${u}" height="${u}"/></g>${dots}`
  }
  if (mode === 'compacting') {
    return `<g class="crush"><rect x="${18 * u}" y="${3 * u}" width="${6 * u}" height="${6 * u}" fill="#f4f1e8"/>${[4, 6].map(py => `<rect x="${19 * u}" y="${py * u}" width="${4 * u}" height="${u / 2}" fill="var(--muted)"/>`).join('')}</g>`
  }
  if (mode === 'responding') {
    return [0, 0.4, 0.8]
      .map((d, i) => `<rect class="ch" style="animation-delay:${d}s" x="${(16 + i) * u}" y="${u}" width="${i === 1 ? u : 2 * u}" height="${u}" fill="var(--ink2)"/>`)
      .join('')
  }
  if (mode === 'error') {
    return [0, 0.4, 0.8]
      .map(d => `<rect class="orbit" style="animation-delay:-${d}s" x="${5 * u}" y="${-3 * u}" width="${u}" height="${u}" fill="var(--s4)"/>`)
      .join('')
  }
  if (mode === 'aborted') {
    return `<path class="bang" d="${cellsPath(BANG, 17 * u, -5 * u, u, u)}" fill="var(--crit)"/>`
  }
  if (mode === 'sleep') return zzz(u)
  return ''
}

const clawd = (x: number, y: number, u: number, p: Pose) => {
  const h = u * 2
  const P = (cells: [number, number][], cls = '') => `<path${cls ? ` class="${cls}"` : ''} d="${cellsPath(cells, 0, 0, u, h)}"/>`
  let body: string
  if (p.mode === 'flat') {
    body = `${P(flip(BODY))}${P(flip(EYES))}${P(flip(LEGS_A), 'kickA')}${P(flip(LEGS_B), 'kickB')}${zzz(u)}`
  } else {
    const moving = p.mode === 'tool' || p.mode === 'responding'
    const legs = moving ? `${P(LEGS_A, 'legA')}${P(LEGS_B, 'legB')}` : P(LEGS_A)
    const eyesShut = p.mode === 'sleep' || p.mode === 'error'
    const eyes = P(EYES, eyesShut ? '' : 'blink')
    const cls = p.celebrate
      ? 'jump'
      : ({ tool: 'walk', writing: 'think', reading: 'think', delegating: 'bob', waiting: 'bob', compacting: 'squash', responding: 'walk', thinking: 'think', error: 'sway', aborted: 'fall', sleep: 'breathe', idle: 'bob' } as const)[p.mode]
    body = `<g class="${cls}">${P(BODY)}${eyes}${legs}</g>${extras(p.mode, u)}`
    if (p.level >= 80 && p.mode !== 'sleep') {
      body += `<g class="sweat"><path d="${cellsPath(DROP, -u, -2 * u, u / 2, u / 2)}" fill="var(--s1)"/><rect x="${-u / 2}" y="${-u / 2}" width="${u / 2}" height="${u / 2}" fill="#fff"/></g>`
    }
    if (p.celebrate) {
      const spots: [number, number][] = [[-2, -1], [19, -1], [-1, 4], [18, 4]]
      body += spots
        .map(([sx, sy], i) => `<path class="spark" style="animation-delay:${i * 0.1}s" fill="var(--s4)" d="M${sx * u} ${sy * u}h${u}v${-u}h${u}v${u}h${u}v${u}h${-u}v${u}h${-u}v${-u}h${-u}z"/>`)
        .join('')
    }
    if (p.level >= 90 && p.mode !== 'sleep') body = `<g class="shake">${body}</g>`
  }
  return `<g transform="translate(${x} ${y})" style="--u:${u}px" fill="${CLAWD}">${body}</g>`
}

const helper = (x: number, y: number, u: number) => {
  const P = (cells: [number, number][], cls: string) => `<path class="${cls}" d="${cellsPath(cells, 0, 0, u, u * 2)}"/>`
  return `<g transform="translate(${x} ${y})" style="--u:${u}px" fill="${CLAWD}"><g class="walk"><path d="${cellsPath(BODY, 0, 0, u, u * 2)}"/>${P(EYES, 'blink')}${P(LEGS_A, 'legA')}${P(LEGS_B, 'legB')}</g></g>`
}

const terminal = (x: number, y: number) =>
  `<rect x="${x}" y="${y}" width="14" height="8" fill="var(--muted)"/><rect x="${x + 1}" y="${y + 1}" width="12" height="6" fill="#1d1d1b"/><path d="M${x + 2} ${y + 2}h1v1h1v1h-1v1h-1z" fill="#0ca30c"/><rect class="bc" x="${x + 5}" y="${y + 4}" width="3" height="1" fill="#0ca30c"/>`

const level = (p: number) => (p >= 90 ? 'crit' : p >= 75 ? 'warn' : 'good')

const filledCells = (p: number, n: number) => (p > 0 ? Math.max(1, Math.round((Math.min(100, p) / 100) * n)) : 0)

const pixBar = (x: number, y: number, n: number, cw: number, ch: number, gap: number, p: number, delay = 0, calm = false) => {
  const filled = filledCells(p, n)
  const lv = calm ? 'good' : level(p)
  const fill = `var(--${lv})`
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const rx = x + i * (cw + gap)
    out.push(`<rect x="${rx}" y="${y}" width="${cw}" height="${ch}" fill="var(--track)"/>`)
    if (i < filled) {
      const cell = `<rect class="pop" style="animation-delay:${delay + i * 35}ms" x="${rx}" y="${y}" width="${cw}" height="${ch}" fill="${fill}"/>`
      out.push(i === filled - 1 && lv === 'crit' ? `<g class="bc">${cell}</g>` : cell)
    }
  }
  if (filled >= 2) {
    out.push(`<rect class="glint" style="--n:${filled - 1};--d:${(filled - 1) * (cw + gap)}px;animation-delay:${delay + 1500}ms" x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#fff"/>`)
  }
  return out.join('')
}

type Gauge = { name: string; p: number; calm?: boolean }

const gauges = (m: Meter): Gauge[] => {
  const list: Gauge[] = []
  if (m.context?.percent !== undefined) list.push({ name: 'ctx', p: m.context.percent, calm: m.context.autoCompact })
  for (const l of m.rateLimits.slice(0, 2)) list.push({ name: limitName(l), p: l.percentUsed })
  return list
}

type Pace = { l: Limit; reset: number; perHour?: number; exhaust?: number }

const pace = (m: Meter, kind: string, now: number): Pace | null => {
  const l = m.rateLimits.find(x => x.kind === kind)
  if (!l) return null
  const b = m.base[kind]
  const reset = l.resetsAt ? Date.parse(l.resetsAt) : Infinity
  if (!b || now - b.t < 10 * 60000 || l.percentUsed <= b.p) return { l, reset }
  const perHour = (l.percentUsed - b.p) / ((now - b.t) / 3600000)
  return { l, reset, perHour, exhaust: now + ((100 - l.percentUsed) / perHour) * 3600000 }
}

const hitRate = (t: TurnRecord) => {
  const all = t.input + t.cacheRead + t.cacheWrite
  return all === 0 ? 0 : Math.round((t.cacheRead / all) * 100)
}

const twinkle = (x: number, y: number) =>
  `<path class="tw" fill="var(--s4)" d="M${x + 2} ${y}h2v2h2v2h-2v2h-2v-2h-2v-2h2z"/>`

export type Tone = 'good' | 'warn' | 'crit' | ''

type Stat = { label: string; value: string; tone: Tone; sep?: boolean; sparkle?: boolean }

const stats = (m: Meter, last: TurnRecord | null, now: number): Stat[] => {
  const list: Stat[] = []
  const empty = m.rateLimits.find(l => l.percentUsed >= 100)
  const p = pace(m, 'five_hour', now)
  if (empty) {
    list.push({ label: `${limitName(empty)} 用完·恢复`, value: empty.resetsAt ? span(Date.parse(empty.resetsAt) - now) : '-', tone: 'crit' })
  } else if (p) {
    const name = limitName(p.l)
    const toReset = p.l.resetsAt ? span(p.reset - now) : '-'
    if (p.perHour === undefined || p.exhaust === undefined) {
      list.push({ label: `${name} 距重置`, value: toReset, tone: '' })
    } else {
      const leftMs = p.exhaust - now
      list.push({ label: `${name} 速度`, value: `${p.perHour.toFixed(1)}%/h`, tone: '' })
      list.push(
        p.exhaust >= p.reset
          ? { label: '撑到重置', value: toReset, tone: 'good' }
          : { label: '预计用完', value: span(leftMs), tone: leftMs < 3600000 ? 'crit' : 'warn' },
      )
    }
  }
  if (list[0]) list[0].sep = true
  if (m.cost != null) list.push({ label: '本会话', value: usd(m.cost), tone: '', sep: true })
  if (!last) {
    list.push({ label: '上轮', value: '-', tone: '', sep: true })
    return list
  }
  const turn: Stat[] = [
    ...(last.ms !== undefined ? [{ label: '上轮', value: dur(last.ms), tone: '' as const }] : []),
    { label: '输出', value: fmt(last.output), tone: '' },
    { label: '缓存', value: `${hitRate(last)}%`, tone: '', sparkle: hitRate(last) >= 90 },
  ]
  turn[0]!.sep = true
  return [...list, ...turn]
}

const TILE_H = 30
const LABEL_Y = 11
const VALUE_Y = 27

const svg = (w: number, h: number, body: string, alt: string): Drawing => {
  const W = Math.ceil(w)
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" shape-rendering="crispEdges">${STYLE}${body}</svg>`,
    width: W,
    height: h,
    alt,
  }
}

const label = (s: string) => `<text x="0" y="${LABEL_Y}" font-size="10" class="mu">${esc(s)}</text>`

const value = (s: string, x: number, tone: Tone) => `<text x="${x}" y="${VALUE_Y}" class="v${tone ? ` ${tone}` : ''}">${esc(s)}</text>`

const divider = () => svg(2, TILE_H, `<rect x="0" y="5" width="2" height="22" fill="var(--grid)"/>`, '|')

const bandPose = (m: Meter, last: TurnRecord | null, now: number, isWorking: boolean, act: Act): Pose => {
  const empty = m.rateLimits.find(l => l.percentUsed >= 100)
  const busy = act === 'thinking' || act === 'tool' || act === 'writing' || act === 'reading' || act === 'delegating' || act === 'responding'
  const mode: Act = isWorking ? (act === 'idle' || act === 'sleep' ? 'thinking' : act) : busy ? 'idle' : act
  return empty
    ? { mode: 'flat', level: 100, celebrate: false }
    : {
        mode,
        level: Math.max(0, ...gauges(m).filter(g => !g.calm).map(g => g.p)),
        celebrate: mode === 'idle' && act === 'idle' && !!last && now - last.at < 15000,
      }
}

const SERIES = [
  { key: 'read', name: '缓存读取' },
  { key: 'write', name: '缓存写入' },
  { key: 'output', name: '输出' },
  { key: 'input', name: '输入' },
] as const

const CHART_STYLE = `<style>
svg{--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--grid:#e4e3dc;--hov:rgba(11,11,11,.05);--tip:#fff;--tipb:#d6d5ce;--c0:#2a78d6;--c1:#eb6834;--c2:#1baf7a;--c3:#eda100;
font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
@media (prefers-color-scheme:dark){svg{--ink:#f0efec;--ink2:#c3c2b7;--grid:#383835;--hov:rgba(255,255,255,.06);--tip:#2b2b29;--tipb:#454541;--c0:#3987e5;--c1:#d95926;--c2:#199e70;--c3:#c98500}}
text{fill:var(--ink2);font-size:14px}.mu{fill:var(--muted)}.tt{fill:var(--ink);font-size:17px;font-weight:600}.pk{fill:var(--ink);font-weight:600}
.tl{fill:var(--muted);font-size:15px}.tv{fill:var(--ink);font-size:32px;font-weight:600;font-variant-numeric:normal}
.hit{fill:transparent}.col:hover .hit{fill:var(--hov)}.tip{visibility:hidden;pointer-events:none}.tip rect.bg{fill:var(--tip);stroke:var(--tipb)}
.avg{stroke:var(--ink2);stroke-width:1;opacity:.6}
</style>`

const r1 = (n: number) => Math.round(n * 10) / 10

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const niceStep = (max: number) => {
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 5, 10].find(m => m * mag >= raw) ?? 10) * mag
}

const topRounded = (x: number, yTop: number, w: number, yBottom: number) => {
  const r = Math.min(5, w / 2, yBottom - yTop)
  return `<path d="M${x} ${yBottom}V${yTop + r}Q${x} ${yTop} ${x + r} ${yTop}H${x + w - r}Q${x + w} ${yTop} ${x + w} ${yTop + r}V${yBottom}Z"`
}

export type ChartDay = { day: string; read: number; write: number; output: number; input: number; tokens: number; calls: number }

export const usageChart = (days: ChartDay[], tiles: [string, string][]): Drawing => {
  const W = 1000
  const ML = 64
  const MR = 72
  const TH = 104
  const PT = TH + 56
  const PH = 260
  const H = PT + PH + 34
  const totals = days.map(d => d.read + d.write + d.output + d.input)
  const max = Math.max(0, ...totals)
  const step = max > 0 ? niceStep(max) : 1
  const top = max > 0 ? Math.ceil(max / step) * step : 4
  const y = (v: number) => r1(PT + PH - (v / top) * PH)
  const tick = (v: number) => (step >= 1 ? `$${Math.round(v)}` : `$${v.toFixed(step >= 0.1 ? 1 : 2)}`)

  const tw = W / Math.max(1, tiles.length)
  const tileRow = tiles.map(([k, v], i) => `<text x="${i * tw}" y="18" class="tl">${esc(k)}</text><text x="${i * tw}" y="60" class="tv">${esc(v)}</text>`).join('')
  const sep = `<line x1="0" x2="${W}" y1="${TH - 18}" y2="${TH - 18}" stroke="var(--grid)" stroke-width="1"/>`

  let legendX = textWidth('每日折算费用', 17) + 32
  const legend = SERIES.map((s, i) => {
    const out = `<rect x="${legendX}" y="${TH + 5}" width="10" height="10" rx="2" fill="var(--c${i})"/><text x="${legendX + 16}" y="${TH + 15}">${esc(s.name)}</text>`
    legendX += 16 + textWidth(s.name, 14) + 20
    return out
  }).join('')
  const head = `${tileRow}${sep}<text x="0" y="${TH + 16}" class="tt">每日折算费用</text>${legend}`

  const grid: string[] = []
  for (let v = 0; v <= top + step / 2; v += step) {
    grid.push(`<line x1="${ML}" x2="${W - MR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${ML - 10}" y="${y(v) + 5}" text-anchor="end" class="mu">${tick(v)}</text>`)
  }

  const n = days.length
  const slot = (W - ML - MR) / Math.max(1, n)
  const bw = r1(Math.min(32, Math.max(1, slot * 0.72)))
  const peak = totals.indexOf(max)
  const cols = days.map((d, i) => {
    const x = r1(ML + i * slot + (slot - bw) / 2)
    const visible = SERIES.map((s, k) => ({ k, v: d[s.key] })).filter(s => (s.v / top) * PH >= 1)
    let base = 0
    const segs = visible.map((s, j) => {
      const yb = y(base) - (j > 0 ? 2 : 0)
      base += s.v
      const yt = y(base)
      if (yb - yt < 0.5) return ''
      return j === visible.length - 1 ? `${topRounded(x, yt, bw, yb)} fill="var(--c${s.k})"/>` : `<rect x="${x}" y="${yt}" width="${bw}" height="${r1(yb - yt)}" fill="var(--c${s.k})"/>`
    })
    return `<g class="col c${i}"><rect class="hit" x="${r1(ML + i * slot)}" y="${PT}" width="${r1(slot)}" height="${PH}"/>${segs.join('')}</g>`
  })

  const TW = 270
  const TH2 = 150
  const tips = days.map((d, i) => {
    if (!(totals[i]! > 0)) return ''
    const cx = r1(ML + (i + 0.5) * slot)
    const tx = cx + 12 + TW > W ? cx - 12 - TW : cx + 12
    const ty = PT + 4
    const head = `${usd(totals[i]!)} · ${fmt(d.tokens)} token · ${d.calls} 次`
    const lines = SERIES.map((s, k) => `<rect x="${tx + 14}" y="${ty + 66 + k * 20}" width="10" height="10" rx="2" fill="var(--c${k})"/><text x="${tx + 30}" y="${ty + 75 + k * 20}">${esc(s.name)}</text><text x="${tx + TW - 14}" y="${ty + 75 + k * 20}" text-anchor="end" class="pk">${esc(usd(d[s.key]))}</text>`).join('')
    return `<g class="tip t${i}"><rect class="bg" x="${tx}" y="${ty}" width="${TW}" height="${TH2}" rx="8"/><text x="${tx + 14}" y="${ty + 24}" class="pk">${esc(`${d.day} ${WEEK[new Date(`${d.day}T12:00:00`).getDay()]}`)}</text><text x="${tx + 14}" y="${ty + 46}">${esc(head)}</text>${lines}</g>`
  })
  const tipRules = days.flatMap((_, i) => (totals[i]! > 0 ? [`.c${i}:hover~.t${i}`] : [])).join(',')
  const tipStyle = tipRules ? `<style>${tipRules}{visibility:visible}</style>` : ''

  const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
  const avgLine = avg > 0 ? `<line class="avg" x1="${ML}" x2="${W - MR}" y1="${y(avg)}" y2="${y(avg)}"/><text x="${W - MR + 8}" y="${y(avg) - 3}" class="mu">日均</text><text x="${W - MR + 8}" y="${y(avg) + 14}" class="mu">${esc(usd(avg))}</text>` : ''

  const every = Math.ceil(n / 6)
  const labels = days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2))
    .map(({ d, i }) => {
      const x = r1(ML + (i + 0.5) * slot)
      const anchor = x + 24 > W ? `x="${W}" text-anchor="end"` : `x="${x}" text-anchor="middle"`
      return `<text ${anchor} y="${PT + PH + 24}" class="mu">${esc(d.day.slice(5))}</text>`
    })
    .join('')

  const peakLabel = max > 0 ? `<text x="${r1(Math.min(W - MR - 32, Math.max(ML + 32, ML + (peak + 0.5) * slot)))}" y="${y(max) - 8}" text-anchor="middle" class="pk">${esc(usd(max))}</text>` : ''
  const empty = max > 0 ? '' : `<text x="${(ML + W - MR) / 2}" y="${PT + PH / 2}" text-anchor="middle" class="mu">这段时间没有用量</text>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CHART_STYLE}${head}${tipStyle}${grid.join('')}${avgLine}${cols.join('')}${peakLabel}${labels}${empty}${tips.join('')}</svg>`,
    width: W,
    height: H,
    alt: `${tiles.map(([k, v]) => `${k} ${v}`).join('，')}。每日折算费用，${days[0]?.day ?? ''} 到 ${days.at(-1)?.day ?? ''}，单日最高 ${usd(max)}`,
  }
}

export const bandParts = (m: Meter, last: TurnRecord | null, now: number, isWorking: boolean, act: Act, helpers: number, chores: number): Drawing[] => {
  const gs = gauges(m)
  const pose = bandPose(m, last, now, isWorking, act)
  const parts: Drawing[] = [svg(60, 40, clawd(4, 10, 2, pose) + (helpers > 0 ? helper(38, 30, 1) : '') + (chores > 0 ? terminal(6, 31) : ''), 'Clawd')]
  gs.forEach((g, i) => {
    const pct = `${g.p}%`
    parts.push(svg(70 + textWidth('100%', 13), TILE_H, `${label(g.name)}${pixBar(0, 17, 10, 5, 10, 1.5, g.p, i * 120, g.calm)}${value(pct, 70, '')}`, `${g.name} ${pct}`))
  })
  for (const s of stats(m, last, now)) {
    if (s.sep) parts.push(divider())
    const vw = textWidth(s.value, 13)
    const spark = s.sparkle ? twinkle(vw + 1, 12) : ''
    parts.push(svg(Math.max(textWidth(s.label, 10), vw + (s.sparkle ? 9 : 0)), TILE_H, `${label(s.label)}${value(s.value, 0, s.tone)}${spark}`, `${s.label} ${s.value}`))
  }
  return parts
}
