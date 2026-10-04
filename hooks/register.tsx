import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Act, Limit, Meter } from '../types'
import { bandSvg, fmt, limitName } from './draw'

const live = atom({ plugin: 'clawd-hud', key: 'live' } as const, null)
const meter = atom({ plugin: 'clawd-hud', key: 'meter' } as const, {
  context: null,
  rateLimits: [],
  base: {},
})
const last = atom({ plugin: 'clawd-hud', key: 'last' } as const, null)
const act = atom({ plugin: 'clawd-hud', key: 'act' } as const, 'idle')

const SLEEP_AFTER = 10 * 60000

const warned = new Set<string>()

type Reading = Pick<Meter, 'context' | 'rateLimits'>

async function setMeter($: EngineInterface, r: Reading) {
  const now = await $.clock.now()
  await update($, meter, old => {
    const base = { ...old.base }
    for (const l of r.rateLimits) {
      const b = base[l.kind]
      if (!b || b.resetsAt !== l.resetsAt || l.percentUsed < b.p) {
        base[l.kind] = { t: now, p: l.percentUsed, resetsAt: l.resetsAt }
      }
    }
    return { ...r, base }
  })
  for (const l of r.rateLimits) warn($, l)
}

function warn($: EngineInterface, l: Limit) {
  for (const at of [80, 95]) {
    const tag = `${l.kind}:${at}:${l.resetsAt ?? ''}`
    if (l.percentUsed >= at && !warned.has(tag)) {
      warned.add(tag)
      $.ui.toast(`${limitName(l)} limit at ${l.percentUsed}%`)
    }
  }
}

let phase: Act = 'idle'
let nap: { cancel: () => void } | null = null

async function setAct($: EngineInterface, next: Act) {
  if (next === phase) return
  phase = next
  await update($, act, () => next)
}

function scheduleNap($: EngineInterface) {
  nap?.cancel()
  nap = $.clock.after(SLEEP_AFTER, () => void setAct($, 'sleep'))
}

export const register: Register = on => {
  let chars = 0
  let lastWrite = 0

  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await setMeter($, { context: u.context, rateLimits: u.rateLimits })
    phase = 'idle'
    await update($, act, () => 'idle')
    scheduleNap($)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await setMeter($, { context: e.context, rateLimits: e.rateLimits })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    nap?.cancel()
    await setAct($, 'thinking')
    chars = 0
    await update($, live, () => ({ out: 0, est: 0 }))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    for await (const c of next(e)) {
      if (c.kind === 'thinking') await setAct($, 'thinking')
      if (c.kind === 'tool') await setAct($, 'tool')
      if (c.kind === 'text') await setAct($, 'responding')
      if (c.kind === 'text' || c.kind === 'thinking') chars += c.text.length
      if (c.kind === 'input') chars += c.json.length
      if (c.kind === 'stop') {
        const out = c.usage?.output_tokens ?? 0
        chars = 0
        await update($, live, l => ({ out: (l?.out ?? 0) + out, est: 0 }))
      } else {
        const now = await $.clock.now()
        if (now - lastWrite > 500) {
          lastWrite = now
          const est = Math.round(chars / 3)
          await update($, live, l => ({ out: l?.out ?? 0, est }))
        }
      }
      yield c
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    if (e.usage) {
      const at = await $.clock.now()
      const u = e.usage
      await update($, last, () => ({
        at,
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
      }))
    }
    await update($, live, () => null)
    await setAct($, e.reason === 'error' ? 'error' : e.reason === 'aborted' ? 'aborted' : 'idle')
    scheduleNap($)
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const l = await read($, live)
    if (!l) return next(e)
    return next({ ...e, props: { ...e.props, suffix: `${e.props.suffix}  ↓ ${fmt(l.out + l.est)} tokens` } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const m = await read($, meter)
    const t = await read($, last)
    const a = await read($, act)

    if (e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)
      const parts = [`ctx ${m.context?.percent ?? '—'}%`, ...m.rateLimits.map(l => `${limitName(l)} ${l.percentUsed}%`)]
      return <Text dimColor>{parts.join(' · ')}</Text>
    }

    const { Svg } = $.ui.resolve(e)
    const band = bandSvg(m, t, await $.clock.now(), e.props.isWorking, a)
    return <Svg source={band.source} width={band.width} height={band.height} alt="Token usage: context, limits, burn rate, last turn" />
  })
}
