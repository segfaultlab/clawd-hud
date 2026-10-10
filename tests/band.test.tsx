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

const ctxTile = async ($: Parameters<Parameters<typeof test>[1]>[0], on: Parameters<Parameters<typeof test>[1]>[1], tokens: number, auto: boolean) => {
  mock.clock(on)
  const context = { tokens, window: 1000000, percent: Math.round(tokens / 10000) }
  const breakdown = auto ? { rawMaxTokens: 480000, autoCompactThreshold: 450000, isAutoCompactEnabled: true } : { rawMaxTokens: 450000, isAutoCompactEnabled: false }
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { ...context, breakdown: breakdown as never } } }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('session.measure', async ($, e) => ({ changed: e.changed }))
  await $.session.measure({ context, rateLimits: [], changed: ['context'] })
  const ui = await $.ui.mount({ plugin: 'clawd-hud', surface: 'desktop', ...BAND })
  const tile = (await ui.findAll({ type: 'Svg' })).map(s => JSON.stringify(s)).find(s => s.includes('ctx '))
  await ui.unmount()
  return tile ?? ''
}

test('ctx counts against the autocompact threshold', async ($, on) => {
  expect(await ctxTile($, on, 225000, true)).toContain('ctx 50%')
})

test('ctx stays green while autocompact is on', async ($, on) => {
  const tile = await ctxTile($, on, 427500, true)
  expect(tile).toContain('ctx 95%')
  expect(tile).toContain('fill=\\"var(--good)\\"')
  expect(tile).not.toContain('fill=\\"var(--crit)\\"')
})

test('ctx turns red when autocompact is off', async ($, on) => {
  const tile = await ctxTile($, on, 427500, false)
  expect(tile).toContain('ctx 95%')
  expect(tile).toContain('fill=\\"var(--crit)\\"')
})
