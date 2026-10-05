import { filledCells, level, type Gauge, type Pose, type Stat } from './draw'

export const TICK = 80

export type Anim = { key: string; sig: string; columns: number; rows: number; draw: (ms: number) => Uint32Array }

type Cells = [number, number][]

const DEFAULT = 0x01000000
const QUAD = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█'

const ORANGE = 0xd77757
const MUTED = 0x898781
const HANDLE = 0x8a5a3c
const AMBER = 0xeda100
const BLUE = 0x2a78d6
const PAGE = 0xf4f1e8
const FLIP = 0xd5ccb6
const PAPER = 0xd6d5ce
const INK = 0x52514e
const RED = 0xd03b3b
const SCREEN = 0x1d1d1b
const GREEN = 0x0ca30c
const LEVEL = { good: 0x0ca30c, warn: 0xe5a50a, crit: 0xd03b3b } as const

const mix = (a: number, b: number, k: number) =>
  [16, 8, 0].reduce((c, s) => c | (Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s), 0)

const second = (ms: number, period: number) => ms % period >= period / 2
const step = (ms: number, period: number, n: number) => Math.floor(((ms % period) / period) * n)

type Grid = { cols: number; rows: number; px: (number | undefined)[]; glyphs: Map<number, [string, number, number]> }

const grid = (cols: number, rows: number): Grid => ({ cols, rows, px: new Array(cols * rows * 4), glyphs: new Map() })

const dot = (g: Grid, x: number, y: number, color: number) => {
  if (x >= 0 && x < g.cols * 2 && y >= 0 && y < g.rows * 2) g.px[y * g.cols * 2 + x] = color
}

const sprite = (g: Grid, cells: Cells, x: number, y: number, color: number) => {
  for (const [cx, cy] of cells) dot(g, x + cx, y + cy, color)
}

const glyph = (g: Grid, col: number, row: number, ch: string, fg = DEFAULT, bg = DEFAULT) => {
  if (col >= 0 && col < g.cols && row >= 0 && row < g.rows) g.glyphs.set(row * g.cols + col, [ch, fg, bg])
}

const pack = (g: Grid) => {
  const pw = g.cols * 2
  const words = new Uint32Array(g.cols * g.rows * 3)
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c
      const set = g.glyphs.get(i)
      if (set) {
        words.set([set[0].codePointAt(0)!, set[1], set[2]], i * 3)
        continue
      }
      const quad = [g.px[2 * r * pw + 2 * c], g.px[2 * r * pw + 2 * c + 1], g.px[(2 * r + 1) * pw + 2 * c], g.px[(2 * r + 1) * pw + 2 * c + 1]]
      const counts = new Map<number, number>()
      for (const q of quad) if (q !== undefined) counts.set(q, (counts.get(q) ?? 0) + 1)
      const [a, b] = [...counts].sort((x, y) => y[1] - x[1] || (x[0] === quad[2] ? 1 : -1))
      const full = !quad.includes(undefined)
      const bg = full && a ? a[0] : DEFAULT
      const fg = full ? (b?.[0] ?? DEFAULT) : (a?.[0] ?? DEFAULT)
      const mask = quad.reduce<number>((m, q, k) => (q !== undefined && q === fg ? m | (1 << k) : m), 0)
      words.set([QUAD.codePointAt(mask)!, fg, bg], i * 3)
    }
  }
  return words
}

const C = 10
const COLS = C + 4
const ROWS = 3
const SIDE = 4
const BARE = 10
const OX = 2
const EYE = 0x000000

const rect = (x0: number, x1: number, y0: number, y1: number): Cells =>
  Array.from({ length: (x1 - x0 + 1) * (y1 - y0 + 1) }, (_, i): [number, number] => [x0 + (i % (x1 - x0 + 1)), y0 + Math.floor(i / (x1 - x0 + 1))])

const BODY: Cells = [...rect(2, 15, 0, 3), [1, 1], [16, 1]]
const EYES: Cells = [[5, 1], [12, 1]]
const LEGS_A: Cells = [[2, 4], [4, 4], [13, 4], [15, 4]]
const LEGS_B: Cells = [[3, 4], [5, 4], [12, 4], [14, 4]]
const FLAT: Cells = [...rect(2, 15, 4, 5), [1, 4], [16, 4]]
const HELPER: Cells = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]
const HELPER_A: Cells = [[1, 1], [4, 1]]
const HELPER_B: Cells = [[2, 1], [3, 1]]

const upside = (cells: Cells): Cells => cells.map(([cx, cy]) => [cx, 5 - cy])
const tall = (cells: Cells): Cells => [...cells, ...cells.map(([cx, cy]): [number, number] => [cx, cy + 1])]

const zzz = (g: Grid, ms: number) => {
  const path: [number, number, string][] = [[C, 1, 'z'], [C, 1, 'z'], [C + 1, 1, 'z'], [C + 1, 0, 'Z'], [C + 2, 0, 'Z'], [C + 2, 0, 'Z']]
  for (const delay of [0, 800, 1600]) {
    if (ms < delay) continue
    const k = step(ms - delay, 2400, 6)
    const [col, row, ch] = path[k]!
    if (k > 0) glyph(g, col, row, ch, k < 3 ? DEFAULT : MUTED)
  }
}

const extras = (g: Grid, mode: Pose['mode'], ms: number, X: number) => {
  const c0 = C + (X - OX) / 2
  const P = 2 * c0
  if (mode === 'thinking') glyph(g, c0, second(ms, 1400) ? 0 : 1, '?')
  if (mode === 'tool') {
    if (second(ms, 500)) {
      sprite(g, rect(0, 4, 0, 0), P - 1, 2, HANDLE)
      sprite(g, rect(0, 1, 0, 1), P + 4, 2, MUTED)
      sprite(g, [[0, 0], [0, 5]], P + 7, 0, AMBER)
    } else {
      sprite(g, rect(0, 1, 0, 1), P, 0, MUTED)
      sprite(g, [[0, 0], [0, 1]], P, 2, HANDLE)
    }
  }
  if (mode === 'writing') {
    const inked = step(ms, 2000, 4)
    for (let c = 0; c < 3; c++) glyph(g, c0 + c, 2, c < inked ? '─' : ' ', INK, PAPER)
    const pen = 2 * (c0 + Math.min(inked, 2))
    sprite(g, second(ms, 160) ? [[0, 0], [1, 1]] : [[0, 1], [1, 0]], pen, 2, AMBER)
  }
  if (mode === 'reading') {
    const p = (ms % 3000) / 3000
    const flipping = p < 0.72 ? [] : p < 0.8 ? [2, 3] : p < 0.88 ? [2] : p < 0.96 ? [1] : [0, 1]
    for (let c = 0; c < 4; c++) {
      const page = flipping.includes(c) ? FLIP : PAGE
      glyph(g, c0 + c, 1, '═', MUTED, page)
      glyph(g, c0 + c, 2, '▄', BLUE, page)
    }
  }
  if (mode === 'waiting') {
    sprite(g, [[0, 0], [0, 1]], P + (second(ms, 400) ? 1 : 0), 0, ORANGE)
    for (let i = 0; i < 3; i++) {
      const lit = ms >= i * 400 && ((ms - i * 400) % 1200) / 1200 < 0.41
      dot(g, P + 3 + 2 * i, 1, lit ? DEFAULT : MUTED)
    }
  }
  if (mode === 'compacting') {
    const k = step(ms, 1500, 3)
    for (const c of [[0, 1, 2], [1, 2], [1]][k]!) {
      glyph(g, c0 + c, 1, k === 0 ? '═' : '▒', MUTED, PAGE)
      glyph(g, c0 + c, 2, k === 0 ? ' ' : '▒', MUTED, PAGE)
    }
  }
  if (mode === 'responding') {
    for (let i = 0; i < 3; i++) {
      const delay = i * 400
      if (ms < delay) continue
      const k = step(ms - delay, 1200, 4)
      const x = P - 1 + i + Math.round(k * 0.25)
      const y = k >= 2 ? 0 : 1
      const color = k < 2 ? DEFAULT : MUTED
      dot(g, x, y, color)
      if (i !== 1) dot(g, x + 1, y, color)
    }
  }
  if (mode === 'error') {
    const orbit: [number, number, number][] = [[0, 0, AMBER], [1, 0, AMBER], [2, 0, AMBER], [1, 1, mix(AMBER, MUTED, 0.6)]]
    for (let i = 0; i < 3; i++) {
      const [col, row, color] = orbit[step(ms + i * 400, 1200, 4)]!
      glyph(g, c0 + col, row, '*', color)
    }
  }
  if (mode === 'aborted' && ms < 1120) glyph(g, c0, 0, '!', RED)
  if (mode === 'sleep') zzz(g, ms)
}

export const clawdAnim = (pose: Pose, helpers: boolean, chores: boolean, bare = false): Anim => {
  const cols = bare ? BARE : COLS + (helpers || chores ? SIDE : 0)
  return {
    key: 'clawd',
    sig: JSON.stringify([pose, helpers, chores, bare]),
    columns: cols,
    rows: ROWS,
    draw: ms => {
      const g = grid(cols, ROWS)
      const m = pose.mode
      if (m === 'flat') {
        sprite(g, upside(BODY), OX, 0, ORANGE)
        sprite(g, upside(EYES), OX, 0, ORANGE)
        sprite(g, upside(second(ms, 600) ? LEGS_B : LEGS_A), OX, 0, ORANGE)
        zzz(g, ms)
      } else {
        const moving = m === 'tool' || m === 'responding'
        const shut = m === 'sleep' || m === 'error'
        const shake = pose.level >= 90 && m !== 'sleep' && second(ms, 200)
        const sway = !pose.celebrate && m === 'error' && second(ms, 1200)
        const X = OX + (shake ? 2 : 0)
        const B = X + (sway ? 2 : 0)
        let lift = false
        let crouch = false
        let sink = 0
        if (pose.celebrate && ms < 1500) {
          const airborne = step(ms, 500, 3) > 0
          lift = airborne
          crouch = !airborne
          sink = airborne ? 0 : 2
        } else if (pose.celebrate) {
          lift = second(ms - 1500, 1200)
        } else if (moving) {
          lift = second(ms, 320)
        } else if (m === 'thinking' || m === 'writing' || m === 'reading') {
          lift = second(ms, 2000)
        } else if (m === 'compacting') {
          crouch = second(ms, 600)
        } else if (m === 'sleep') {
          crouch = second(ms, 2400)
        } else if (m === 'aborted') {
          crouch = ms >= 350 && ms < 1400
        } else if (m !== 'error') {
          lift = second(ms, 1200)
        }
        const blink = !shut && ms % 4000 >= 3680 && ms % 4000 < 3840
        const legs = moving && second(ms, 320) ? LEGS_B : LEGS_A
        const squashed = m === 'aborted' && crouch
        sprite(g, squashed ? FLAT : BODY, B, sink, ORANGE)
        sprite(g, squashed ? EYES.map(([x]): [number, number] => [x, 4]) : EYES, B, sink, shut || blink ? ORANGE : EYE)
        if (!crouch) sprite(g, lift ? tall(legs) : legs, B, 0, ORANGE)
        extras(g, m, ms, X)
        if (pose.level >= 80 && m !== 'sleep') {
          const k = step(ms, 1600, 4)
          sprite(g, [[0, 0], [0, 1]], X - 1, k >= 2 ? 1 : 0, [BLUE, BLUE, 0x6f9fe0, 0xa9c6ee][k]!)
        }
        if (pose.celebrate) {
          const spots: [number, number][] = [[0, 0], [C, 0], [0, 2], [C, 2]]
          spots.forEach(([col, row], i) => {
            const t = ms - i * 100
            if (t < 0 || t >= 1600) return
            const k = step(t, 800, 4)
            if (k > 0) glyph(g, col, row, k === 2 ? '*' : '+', k === 2 ? AMBER : mix(AMBER, MUTED, 0.5))
          })
        }
      }
      if (chores) {
        glyph(g, COLS, 0, '▐', MUTED)
        glyph(g, COLS + 1, 0, '>', GREEN, SCREEN)
        glyph(g, COLS + 2, 0, '_', second(ms, 1000) ? mix(GREEN, SCREEN, 0.8) : GREEN, SCREEN)
        glyph(g, COLS + 3, 0, '▌', MUTED)
      }
      if (helpers) {
        sprite(g, HELPER, 2 * COLS, 4, ORANGE)
        sprite(g, second(ms, 320) ? HELPER_B : HELPER_A, 2 * COLS, 4, ORANGE)
      }
      return pack(g)
    },
  }
}

export type BarCell = 'track' | 'fill' | 'shine' | 'fade'

export const barCells = (p: number, n: number, delay: number, ms: number): BarCell[] => {
  const filled = filledCells(p, n)
  const sweep = ms - delay - 1500
  const phase = sweep >= 0 && filled >= 2 ? (sweep % 3500) / 3500 : 1
  const shine = phase < 0.4 ? Math.floor((phase / 0.4) * (filled - 1)) : -1
  return Array.from({ length: n }, (_, i) => {
    if (i >= filled || ms < delay + i * 35) return 'track'
    if (i === filled - 1 && p >= 90 && second(ms - delay - i * 35, 1000)) return 'fade'
    return i === shine ? 'shine' : 'fill'
  })
}

export const barColor = (p: number, cell: BarCell) => {
  const color = LEVEL[level(p)]
  return `#${(cell === 'shine' ? mix(color, 0xffffff, 0.55) : cell === 'fade' ? mix(color, 0x888888, 0.6) : color).toString(16).padStart(6, '0')}`
}

export const twinkleAnim = (key: string): Anim => ({
  key,
  sig: '',
  columns: 1,
  rows: 1,
  draw: ms => {
    const g = grid(1, 1)
    glyph(g, 0, 0, second(ms, 1600) ? '✧' : '✦', AMBER)
    return pack(g)
  },
})

const cells = (s: string) => [...s].reduce((w, ch) => w + (/[⺀-￿]/.test(ch) ? 2 : 1), 0)

export type Plan = { gap: number; bar: number; clawd: 'side' | 'full' | 'bare' | 'none'; groups: Stat[][] }

const DROP_ORDER = (s: Stat) =>
  s.label === '输出' ? 0 : s.label === '缓存' ? 1 : s.label === '上轮' ? 3 : s.label.endsWith('速度') ? 4 : s.label === '本会话' ? 6 : 7

export const fitBand = (width: number, gauges: Gauge[], stats: Stat[], clawd: Plan['clawd']): Plan => {
  const order = stats.map((_, i) => i).sort((a, b) => DROP_ORDER(stats[a]!) - DROP_ORDER(stats[b]!))
  const plan = { gap: 2, bar: 10, clawd, dropped: 0 }
  const layout = (): Plan => {
    const gone = new Set(order.slice(0, plan.dropped))
    const groups: Stat[][] = []
    stats.forEach((st, i) => {
      if (st.sep || groups.length === 0) groups.push([])
      if (!gone.has(i)) groups.at(-1)!.push(st)
    })
    return { gap: plan.gap, bar: plan.bar, clawd: plan.clawd, groups: groups.filter(g => g.length > 0) }
  }
  const total = (p: Plan) => {
    const widths = [
      ...(p.clawd === 'none' ? [] : [p.clawd === 'side' ? COLS + SIDE : p.clawd === 'full' ? COLS : BARE]),
      ...gauges.map(g => Math.max(cells(g.name), p.bar + 1 + cells(`${g.p}%`))),
      ...p.groups.flatMap(g => [1, ...g.map(st => Math.max(cells(st.label), cells(st.value) + (st.sparkle ? 1 : 0)))]),
    ]
    return widths.reduce((a, b) => a + b, 0) + p.gap * Math.max(0, widths.length - 1)
  }
  const drop = (upTo: number) => () => {
    while (plan.dropped < order.length && DROP_ORDER(stats[order[plan.dropped]!]!) <= upTo) plan.dropped++
  }
  const steps = [
    () => (plan.gap = 1),
    () => (plan.bar = 8),
    () => (plan.bar = 6),
    () => (plan.clawd = plan.clawd === 'side' ? 'full' : plan.clawd),
    drop(1),
    () => (plan.bar = 4),
    drop(4),
    () => (plan.clawd = plan.clawd === 'none' ? 'none' : 'bare'),
    drop(6),
    drop(7),
    () => (plan.clawd = 'none'),
  ]
  for (const next of steps) {
    if (total(layout()) <= width) break
    next()
  }
  return layout()
}
