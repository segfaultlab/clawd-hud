import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

test('the desktop band draws Svg', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('the terminal draws no band', async ($, on) => {
  mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeUndefined()
  await ui.unmount()
})

test('ctx counts against the autocompact window', async ($, on) => {
  mock.clock(on)
  const context = { tokens: 225000, window: 1000000, percent: 23 }
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, rateLimits: [], context: { ...context, breakdown: { rawMaxTokens: 450000 } as never } },
  }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('session.measure', async ($, e) => ({ changed: e.changed }))
  await $.session.measure({ context, rateLimits: [], changed: ['context'] })
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'desktop', ...BAND })
  const alts = (await ui.findAll({ type: 'Svg' })).map(s => JSON.stringify(s))
  expect(alts.some(a => a.includes('ctx 50%'))).toBe(true)
  await ui.unmount()
})
