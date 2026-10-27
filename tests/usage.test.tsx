import { expect, mock, test } from 'claude-code/testing'

import { localDay, priceOf, summarize, tallyScan } from '../hooks/ledger'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

const PANE = {
  component: 'Pane',
  requestId: 'usage',
  props: { title: 'Token 用量', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const NOW = Date.parse('2026-10-27T12:00:00')
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86400000).toISOString()

const entry = (line: number, model: string, id: string, req: string, at: string, nums: Record<string, number>) =>
  [
    `${line}:"model":"${model}","id":"${id}"`,
    ...Object.entries(nums).map(([k, v]) => `${line}:"${k}":${v}`),
    `${line}:"input_tokens":999`,
    `${line}:"requestId":"${req}"`,
    `${line}:"timestamp":"${at}"`,
  ].join('\n')

const SAMPLE = [
  entry(1, 'claude-opus-5-5', 'msg_a', 'req_a', iso(0), { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 5000, output_tokens: 200, ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 0 }),
  entry(2, 'claude-opus-5-5', 'msg_a', 'req_a', iso(0), { input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 5000, output_tokens: 200, ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 0 }),
  entry(3, 'claude-sonnet-5-5', 'msg_b', 'req_b', iso(40), { input_tokens: 5, cache_creation_input_tokens: 400, cache_read_input_tokens: 0, output_tokens: 50 }),
  entry(4, '<synthetic>', 'msg_c', 'req_c', iso(0), { input_tokens: 0, output_tokens: 0 }),
  entry(5, 'claude-mystery-1', 'msg_d', 'req_d', iso(1), { input_tokens: 1, cache_read_input_tokens: 0, output_tokens: 1 }),
].join('\n')

test('the scan keeps the first usage of a line and drops repeats and synthetic turns', () => {
  const rows = tallyScan(SAMPLE)
  const opus = rows.find(r => r.model === 'claude-opus-5-5')
  expect(opus).toMatchObject({ day: localDay(NOW), input: 10, output: 200, write1h: 1000, write5m: 0, read: 5000, calls: 1 })
  expect(rows.find(r => r.model === 'claude-sonnet-5-5')).toMatchObject({ write5m: 400, write1h: 0, calls: 1 })
  expect(rows.some(r => r.model === '<synthetic>')).toBe(false)
})

test('cost follows the API prices', () => {
  const t = { input: 1e6, output: 1e6, write5m: 1e6, write1h: 1e6, read: 1e6, calls: 1 }
  expect(Math.round(priceOf('claude-opus-5-5', t)! * 100) / 100).toBe(37.2)
  expect(priceOf('claude-mystery-1', t)).toBeNull()
})

test('30 days leaves out older days, all keeps them', () => {
  const rows = tallyScan(SAMPLE)
  const today = localDay(NOW)
  const month = summarize(rows, localDay(NOW - 29 * 86400000), today)
  expect(month.models.map(m => m.model).sort()).toEqual(['claude-mystery-1', 'claude-opus-5-5'])
  expect(month.unpriced).toBe(true)
  expect(month.daily).toHaveLength(30)
  expect(month.daily.at(-1)).toMatchObject({ day: today, calls: 1 })
  const all = summarize(rows, null, today)
  expect(all.models).toHaveLength(3)
  expect(all.daily).toHaveLength(41)
})

test('the band button opens the pane and the pane shows the totals', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { HOME: '/home/me' })
  const opened: string[] = []
  const spawned: { argv: readonly string[]; cwd?: string }[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('process.spawn', async function* (_, e) {
    spawned.push({ argv: e.argv, cwd: e.cwd })
    yield { stream: 'stdout' as const, text: SAMPLE }
    return { value: { code: 0, signal: null } }
  })

  const band = await $.ui.mount({ plugin: 'clawd-hud', surface: 'desktop', ...BAND })
  await band.press({ key: 'usage' })
  await band.unmount()
  expect(opened).toEqual(['usage'])
  expect(spawned[0]?.cwd).toBe('/home/me/.claude/projects')

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'clawd-hud', surface, ...PANE })
    if (surface === 'desktop') expect((await ui.find({ type: 'Svg' }))?.props).toMatchObject({ alt: expect.stringContaining('折算费用 $') })
    else expect((await ui.find({ type: 'Text', text: /折算费用/ }))?.text).toContain('总 token')
    expect(JSON.stringify(await ui.find({ type: 'Markdown' }))).toContain('opus-5-5')
    await ui.press({ key: 'all' })
    expect(JSON.stringify(await ui.find({ type: 'Markdown' }))).toContain('sonnet-5-5')
    await ui.press({ key: 'month' })
    await ui.unmount()
  }
})
