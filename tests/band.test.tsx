import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

test('the terminal band draws Clawd as a Raster', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'terminal', ...BAND })
  const clawd = await ui.find({ type: 'Raster', key: 'clawd' })
  expect(clawd?.props.columns).toBe(15)
  expect(clawd?.props.rows).toBe(5)
  expect(String(clawd?.props.cells).length).toBe(1200)
  await ui.unmount()
})

test('the desktop band still draws Svg', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('a terminal Clawd keeps moving after it is drawn', async ($, on) => {
  const clock = mock.clock(on)
  const blits: { key: string; cells: string }[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 34 }, rateLimits: [] } }))
  on('agent.list', () => ({ value: [] }))
  on('ui.blit', (_$, e) => {
    if ('cells' in e) blits.push({ key: e.key, cells: e.cells })
    return { value: {} }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'terminal', requestId: 'band', ...BAND })
  const bar = await ui.find({ type: 'Raster', key: 'bar-ctx' })
  expect(bar?.props.columns).toBe(10)
  await clock.advance(1200)
  expect(blits.some(b => b.key === 'clawd')).toBe(true)
  expect(blits.some(b => b.key === 'bar-ctx')).toBe(true)
  await ui.unmount()
})

