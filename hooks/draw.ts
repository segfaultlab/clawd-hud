import type { Act, Limit, Meter, TurnRecord } from '../types'

export const fmt = (n: number) =>
  n < 1000 ? `${n}` : n < 1e6 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1e6).toFixed(2)}M`

const span = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'wk',
  spend_limit: 'spend',
}

export const limitName = (l: Limit) => LIMIT_NAMES[l.kind] ?? l.kind

export type Drawing = { source: string; width: number; height: number }

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
text{fill:var(--ink)}.t2{fill:var(--ink2)}.mu{fill:var(--muted)}
.good{fill:var(--goodt)}.warn{fill:var(--warnt)}.crit{fill:var(--crit)}
.pop{opacity:0;animation:pop 1ms linear forwards}@keyframes pop{to{opacity:1}}
.bc{animation:bc 1s steps(1) infinite}@keyframes bc{50%{opacity:.2}}
.bob{animation:bob 1.2s steps(1) infinite}.walk{animation:bob .32s steps(1) infinite}
@keyframes bob{50%{transform:translateY(calc(var(--u) * -1))}}
.legA{animation:legA .32s steps(1) infinite}@keyframes legA{50%{opacity:0}}
.legB{animation:legB .32s steps(1) infinite}@keyframes legB{0%{opacity:0}50%{opacity:1}}
.blink{opacity:0;animation:blink 4s steps(1) infinite}@keyframes blink{0%{opacity:0}92%{opacity:1}96%{opacity:0}}
.sweat{animation:sweat 1s steps(4) infinite}@keyframes sweat{to{transform:translateY(calc(var(--u) * 4));opacity:0}}
.kickA{animation:legA .6s steps(1) infinite}.kickB{animation:legB .6s steps(1) infinite}
.zz{opacity:0;animation:zz 2.4s steps(6) infinite}@keyframes zz{0%{opacity:0;transform:none}15%{opacity:1}100%{opacity:0;transform:translate(calc(var(--u) * 3),calc(var(--u) * -4))}}
.jump{animation:jump .5s steps(3) 3}@keyframes jump{50%{transform:translateY(calc(var(--u) * -3))}}
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

const zzz = (u: number) =>
  [0, 0.8, 1.6]
    .map((d, i) => `<path class="zz" style="animation-delay:${d}s" d="${cellsPath(Z, 16 * u + i * u, -u - i * u, u * 0.8, u * 0.8)}" fill="var(--ink2)"/>`)
    .join('')

const extras = (mode: Pose['mode'], u: number) => {
  if (mode === 'thinking') {
    return `<path class="q" d="${cellsPath(Q, 15 * u, -5 * u, u * 0.8, u * 0.8)}" fill="var(--ink2)"/>`
  }
  if (mode === 'tool') {
    return `<g class="hamA"><rect x="${17 * u}" y="${-2 * u}" width="${u}" height="${6 * u}" fill="#8a5a3c"/><rect x="${16 * u}" y="${-4 * u}" width="${3 * u}" height="${2 * u}" fill="var(--muted)"/></g>
<g class="hamB"><rect x="${17 * u}" y="${3 * u}" width="${5 * u}" height="${u}" fill="#8a5a3c"/><rect x="${21 * u}" y="${u}" width="${2 * u}" height="${4 * u}" fill="var(--muted)"/><rect x="${24 * u}" y="0" width="${u}" height="${u}" fill="var(--s4)"/><rect x="${24 * u}" y="${5 * u}" width="${u}" height="${u}" fill="var(--s4)"/></g>`
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
      : ({ tool: 'walk', responding: 'walk', thinking: 'think', error: 'sway', aborted: 'fall', sleep: 'breathe', idle: 'bob' } as const)[p.mode]
    body = `<g class="${cls}">${P(BODY)}${eyes}${legs}</g>${extras(p.mode, u)}`
    if (p.level >= 80 && p.mode !== 'sleep') {
      body += `<rect class="sweat" x="${17 * u}" y="${-h * 0.5}" width="${u}" height="${h}" fill="var(--s1)"/>`
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

const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '%': ['101', '001', '010', '100', '101'],
}

const pixelText = (s: string, x: number, y: number, u: number, fill: string) => {
  const cells: [number, number][] = []
  let cx = 0
  for (const ch of s) {
    const g = GLYPHS[ch] ?? ['0', '0', '0', '0', '0']
    g.forEach((row, ry) => [...row].forEach((bit, rx) => bit === '1' && cells.push([cx + rx, ry])))
    cx += g[0]!.length + 1
  }
  return { svg: `<path d="${cellsPath(cells, x, y, u, u)}" fill="${fill}"/>`, width: (cx - 1) * u }
}

const statusFill = (p: number) => (p >= 90 ? 'var(--crit)' : p >= 70 ? 'var(--warn)' : 'var(--good)')

const pixBar = (x: number, y: number, n: number, cw: number, ch: number, gap: number, p: number, delay = 0) => {
  const filled = p > 0 ? Math.max(1, Math.round((Math.min(100, p) / 100) * n)) : 0
  const fill = statusFill(p)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const rx = x + i * (cw + gap)
    out.push(`<rect x="${rx}" y="${y}" width="${cw}" height="${ch}" fill="var(--track)"/>`)
    if (i < filled) {
      const cell = `<rect class="pop" style="animation-delay:${delay + i * 35}ms" x="${rx}" y="${y}" width="${cw}" height="${ch}" fill="${fill}"/>`
      out.push(i === filled - 1 && p >= 90 ? `<g class="bc">${cell}</g>` : cell)
    }
  }
  if (filled >= 2) {
    out.push(`<rect class="glint" style="--n:${filled - 1};--d:${(filled - 1) * (cw + gap)}px;animation-delay:${delay + 1500}ms" x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#fff"/>`)
  }
  return out.join('')
}

type Gauge = { name: string; p: number }

const gauges = (m: Meter): Gauge[] => {
  const list: Gauge[] = []
  if (m.context?.percent !== undefined) list.push({ name: 'ctx', p: m.context.percent })
  for (const l of m.rateLimits.slice(0, 2)) list.push({ name: limitName(l), p: l.percentUsed })
  return list
}

type Burn = { rate: string; verdict: string; tone: 'good' | 'warn' | 'crit' | 'mu' }

const burn = (m: Meter, kind: string, now: number): Burn => {
  const l = m.rateLimits.find(x => x.kind === kind)
  const b = m.base[kind]
  if (!l || !b || now - b.t < 10 * 60000 || l.percentUsed <= b.p) {
    return { rate: '', verdict: 'estimating…', tone: 'mu' }
  }
  const perHour = (l.percentUsed - b.p) / ((now - b.t) / 3600000)
  const exhaust = now + ((100 - l.percentUsed) / perHour) * 3600000
  const reset = l.resetsAt ? Date.parse(l.resetsAt) : Infinity
  const rate = `${perHour.toFixed(1)}%/h `
  if (exhaust >= reset) return { rate, verdict: 'lasts till reset', tone: 'good' }
  const leftMs = exhaust - now
  return { rate, verdict: `empty in ~${span(leftMs)}`, tone: leftMs < 3600000 ? 'crit' : 'warn' }
}

const hitRate = (t: TurnRecord) => {
  const all = t.input + t.cacheRead + t.cacheWrite
  return all === 0 ? 0 : Math.round((t.cacheRead / all) * 100)
}

const twinkle = (x: number, y: number) =>
  `<path class="tw" fill="var(--s4)" d="M${x + 2} ${y}h2v2h2v2h-2v2h-2v-2h-2v-2h2z"/>`

export const bandSvg = (m: Meter, last: TurnRecord | null, now: number, isWorking: boolean, act: Act): Drawing => {
  const H = 36
  const gs = gauges(m)
  const empty = m.rateLimits.find(l => l.percentUsed >= 100)
  const mode: Act = isWorking ? (act === 'idle' || act === 'sleep' ? 'thinking' : act) : act
  const pose: Pose = empty
    ? { mode: 'flat', level: 100, celebrate: false }
    : {
        mode,
        level: Math.max(0, ...gs.map(g => g.p)),
        celebrate: mode === 'idle' && !!last && now - last.at < 15000,
      }
  const out: string[] = [clawd(4, 10, 2, pose)]
  let x = 58
  gs.forEach((g, i) => {
    out.push(`<text x="${x}" y="12" font-size="10" class="mu">${esc(g.name)}</text>`)
    out.push(pixBar(x, 17, 10, 5, 10, 1.5, g.p, i * 120))
    const digits = pixelText(`${g.p}%`, x + 69, 19, 1.6, 'var(--ink)')
    out.push(digits.svg)
    x += 69 + digits.width + 16
  })
  const b: Burn = empty
    ? { rate: '', verdict: `${limitName(empty)} limit hit · back in ${empty.resetsAt ? span(Date.parse(empty.resetsAt) - now) : '?'}`, tone: 'crit' }
    : burn(m, 'five_hour', now)
  const line1 = empty ? '' : `5h burn ${b.rate}`
  const line2 = last
    ? `last ↑${fmt(last.input + last.cacheRead + last.cacheWrite)} ↓${fmt(last.output)} cache ${hitRate(last)}%`
    : 'last —'
  out.push(`<rect x="${x - 6}" y="8" width="2" height="22" fill="var(--grid)"/>`)
  x += 6
  out.push(`<text x="${x}" y="15" font-size="11" class="t2">${esc(line1)}<tspan class="${b.tone}">${esc(b.verdict)}</tspan></text>`)
  out.push(`<text x="${x}" y="30" font-size="11" class="t2">${esc(line2)}</text>`)
  if (last && hitRate(last) >= 90) out.push(twinkle(Math.ceil(x + textWidth(line2, 11)) + 4, 21))
  const W = Math.ceil(x + Math.max(textWidth(line1 + b.verdict, 11), textWidth(line2, 11) + 14) + 6)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${STYLE}${out.join('')}</svg>`
  return { source, width: W, height: H }
}
