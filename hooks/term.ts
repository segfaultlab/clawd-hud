import { BODY, EYES, LEGS_A, LEGS_B, filledCells, level, type Pose } from './draw'

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
      const [a, b] = [...counts].sort((x, y) => y[1] - x[1])
      const blank = quad.filter(q => q === undefined).length
      const fg = a?.[0] ?? DEFAULT
      const bg = b && b[1] > blank ? b[0] : DEFAULT
      const mask = quad.reduce<number>((m, q, k) => (a && q === fg ? m | (1 << k) : m), 0)
      words.set([QUAD.codePointAt(mask)!, fg, bg], i * 3)
    }
  }
  return words
}

const COLS = 15
const ROWS = 5
const OX = 2
const OY = 2

const trim = (cells: Cells): Cells => cells.filter(([cx, cy]) => cy !== 0 || (cx > 3 && cx < 14))
const fallen = (cells: Cells): Cells => cells.filter(([, cy]) => cy !== 0 && cy !== 3).map(([cx, cy]) => [cx, cy === 4 ? 4 : cy + 1])
const upside = (cells: Cells): Cells => cells.map(([cx, cy]) => [cx, 4 - cy])

const MINI: Cells = [[1, 0], [3, 0], [4, 0], [5, 0], [7, 0], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((x): [number, number] => [x, 1])]
const MINI_A: Cells = [[1, 2], [3, 2], [5, 2], [7, 2]]
const MINI_B: Cells = [[2, 2], [4, 2], [6, 2], [8, 2]]

const zzz = (g: Grid, ms: number) => {
  const path: [number, number, string][] = [[9, 1, 'z'], [9, 1, 'z'], [10, 1, 'z'], [10, 0, 'Z'], [11, 0, 'Z'], [11, 0, 'Z']]
  for (const delay of [0, 800, 1600]) {
    if (ms < delay) continue
    const k = step(ms - delay, 2400, 6)
    const [col, row, ch] = path[k]!
    if (k > 0) glyph(g, col, row, ch, k < 3 ? DEFAULT : MUTED)
  }
}

const extras = (g: Grid, mode: Pose['mode'], ms: number, X: number) => {
  if (mode === 'thinking') glyph(g, 10, second(ms, 1400) ? 0 : 1, '?')
  if (mode === 'tool') {
    if (second(ms, 500)) {
      sprite(g, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], X + 17, 4, HANDLE)
      sprite(g, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], X + 22, 3, MUTED)
      sprite(g, [[0, 0], [0, 4]], X + 25, 2, AMBER)
    } else {
      sprite(g, [[0, 0], [1, 0], [2, 0], [3, 0]], X + 16, 1, MUTED)
      sprite(g, [[0, 0], [0, 1]], X + 17, 2, HANDLE)
    }
  }
  if (mode === 'writing') {
    const k = step(ms, 2000, 4)
    const inked = [0, 1, 2, 3][k]!
    for (let c = 0; c < 3; c++) glyph(g, 10 + c, 3, c < inked ? '─' : ' ', INK, PAPER)
    const pen = X + 18 + 2 * Math.min(inked, 2)
    sprite(g, [[0, 1], [1, 0]], pen, 4 - (second(ms, 160) ? 1 : 0), AMBER)
  }
  if (mode === 'reading') {
    const p = (ms % 3000) / 3000
    const flipping = p < 0.72 ? [] : p < 0.8 ? [12, 13] : p < 0.88 ? [12] : p < 0.96 ? [11] : [10, 11]
    for (let c = 10; c < 14; c++) {
      const page = flipping.includes(c) ? FLIP : PAGE
      glyph(g, c, 1, '▄', page)
      glyph(g, c, 2, '═', MUTED, page)
      glyph(g, c, 3, '▀', page, BLUE)
    }
  }
  if (mode === 'waiting') {
    sprite(g, [[0, 0], [0, 1], [0, 2]], X + 17, 2, ORANGE)
    sprite(g, [[0, 0], [2, 0]], X + 16 + (second(ms, 400) ? 1 : 0), 1, ORANGE)
    for (let i = 0; i < 3; i++) {
      const lit = ms >= i * 400 && ((ms - i * 400) % 1200) / 1200 < 0.41
      dot(g, X + 20 + 2 * i, 1, lit ? DEFAULT : MUTED)
    }
  }
  if (mode === 'compacting') {
    const k = step(ms, 1500, 3)
    const cols = [[10, 11, 12], [11, 12], [11]][k]!
    for (const c of cols) {
      glyph(g, c, 2, k === 0 ? '═' : '▒', MUTED, PAGE)
      glyph(g, c, 3, k === 0 ? ' ' : '▒', MUTED, PAGE)
    }
  }
  if (mode === 'responding') {
    for (let i = 0; i < 3; i++) {
      const delay = i * 400
      if (ms < delay) continue
      const k = step(ms - delay, 1200, 4)
      const x = X + 16 + i + Math.round(k * 0.25)
      const y = 3 - Math.round(k * 0.625)
      const color = k < 2 ? DEFAULT : MUTED
      dot(g, x, y, color)
      if (i !== 1) dot(g, x + 1, y, color)
    }
  }
  if (mode === 'error') {
    const orbit: [number, number][] = [[3, AMBER], [5, AMBER], [6, AMBER], [5, mix(AMBER, MUTED, 0.6)]]
    for (let i = 0; i < 3; i++) {
      const [col, color] = orbit[step(ms + i * 400, 1200, 4)]!
      glyph(g, col + (X - OX), 0, '*', color)
    }
  }
  if (mode === 'aborted' && ms < 1120) glyph(g, 9, 0, '!', RED)
  if (mode === 'sleep') zzz(g, ms)
}

export const clawdAnim = (pose: Pose, helpers: boolean, chores: boolean): Anim => ({
  key: 'clawd',
  sig: JSON.stringify([pose, helpers, chores]),
  columns: COLS,
  rows: ROWS,
  draw: ms => {
    const g = grid(COLS, ROWS)
    const m = pose.mode
    if (m === 'flat') {
      sprite(g, upside(BODY), OX, OY, ORANGE)
      sprite(g, upside(EYES), OX, OY, ORANGE)
      sprite(g, upside(second(ms, 600) ? LEGS_B : LEGS_A), OX, OY, ORANGE)
      zzz(g, ms)
    } else {
      const X = OX + (pose.level >= 90 && m !== 'sleep' && second(ms, 200) ? 1 : 0)
      const moving = m === 'tool' || m === 'responding'
      const shut = m === 'sleep' || m === 'error'
      let bx = 0
      let by = 0
      let shape = (cells: Cells) => cells
      if (pose.celebrate) {
        by = ms < 1500 ? (step(ms, 500, 3) > 0 ? -1 : 0) : second(ms - 1500, 1200) ? -1 : 0
      } else if (moving) {
        by = second(ms, 320) ? -1 : 0
      } else if (m === 'thinking' || m === 'writing' || m === 'reading') {
        by = second(ms, 2000) ? -1 : 0
      } else if (m === 'compacting') {
        if (second(ms, 600)) shape = trim
      } else if (m === 'sleep') {
        if (second(ms, 2400)) shape = trim
      } else if (m === 'error') {
        bx = second(ms, 1200) ? 1 : 0
      } else if (m === 'aborted') {
        if (ms >= 350 && ms < 1400) shape = fallen
      } else {
        by = second(ms, 1200) ? -1 : 0
      }
      const blink = !shut && ms % 4000 >= 3680 && ms % 4000 < 3840
      sprite(g, shape(BODY), X + bx, OY + by, ORANGE)
      if (shut || blink) sprite(g, shape(EYES), X + bx, OY + by, ORANGE)
      sprite(g, shape(moving && second(ms, 320) ? LEGS_B : LEGS_A), X + bx, OY + by, ORANGE)
      extras(g, m, ms, X)
      if (pose.level >= 80 && m !== 'sleep') {
        const k = step(ms, 1600, 4)
        sprite(g, [[0, 0], [0, 1]], X - 1, 1 + (k >= 2 ? 1 : 0), [BLUE, BLUE, 0x6f9fe0, 0xa9c6ee][k]!)
      }
      if (pose.celebrate) {
        const spots: [number, number][] = [[0, 0], [10, 0], [0, 2], [10, 2]]
        spots.forEach(([col, row], i) => {
          const t = ms - i * 100
          if (t < 0 || t >= 1600) return
          const k = step(t, 800, 4)
          if (k > 0) glyph(g, col, row, k === 2 ? '*' : '+', k === 2 ? AMBER : mix(AMBER, MUTED, 0.5))
        })
      }
    }
    if (helpers) {
      sprite(g, MINI, 20, 7, ORANGE)
      sprite(g, second(ms, 320) ? MINI_B : MINI_A, 20, 7, ORANGE)
    }
    if (chores) {
      glyph(g, 1, 4, '▐', MUTED)
      glyph(g, 2, 4, '>', GREEN, SCREEN)
      glyph(g, 3, 4, '_', second(ms, 1000) ? mix(GREEN, SCREEN, 0.8) : GREEN, SCREEN)
      glyph(g, 4, 4, '▌', MUTED)
    }
    return pack(g)
  },
})

export const barAnim = (key: string, p: number, delay: number): Anim => ({
  key,
  sig: `${p}`,
  columns: 10,
  rows: 1,
  draw: ms => {
    const g = grid(10, 1)
    const filled = filledCells(p, 10)
    const color = LEVEL[level(p)]
    const sweep = ms - delay - 1500
    const phase = sweep >= 0 && filled >= 2 ? (sweep % 3500) / 3500 : 1
    const shine = phase < 0.4 ? Math.floor((phase / 0.4) * (filled - 1)) : -1
    for (let i = 0; i < 10; i++) {
      const on = i < filled && ms >= delay + i * 35
      const fading = on && i === filled - 1 && p >= 90 && second(ms - delay - i * 35, 1000)
      if (!on || fading) glyph(g, i, 0, '░', on ? color : MUTED)
      else glyph(g, i, 0, '█', i === shine ? mix(color, 0xffffff, 0.55) : color)
    }
    return pack(g)
  },
})

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
