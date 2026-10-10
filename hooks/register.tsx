import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Act, Limit, Meter } from '../types'
import { bandParts, limitName } from './draw'

const meter = atom({ plugin: 'clawd-hud', key: 'meter' } as const, {
  context: null,
  rateLimits: [],
  cost: null,
  base: {},
})
const last = atom({ plugin: 'clawd-hud', key: 'last' } as const, null)
const act = atom({ plugin: 'clawd-hud', key: 'act' } as const, 'idle')
const helpers = atom({ plugin: 'clawd-hud', key: 'helpers' } as const, 0)
const chores = atom({ plugin: 'clawd-hud', key: 'chores' } as const, 0)

const SLEEP_AFTER = 60 * 60000

const PEN_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit'])
const BOOK_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'])

const toolAct = (name: string): Act =>
  PEN_TOOLS.has(name)
    ? 'writing'
    : BOOK_TOOLS.has(name)
      ? 'reading'
      : name === 'Agent'
        ? 'delegating'
        : 'tool'

const LOOK_CMDS = new Set(['cat', 'head', 'tail', 'less', 'grep', 'egrep', 'rg', 'find', 'fd', 'ls', 'tree', 'wc'])
const PIPE_CMDS = new Set([...LOOK_CMDS, 'sed', 'awk', 'sort', 'uniq', 'cut'])

const bashAct = (cmd: string): Act => {
  if (/\$\(|`|\n/.test(cmd)) return 'tool'
  const bare = cmd
    .replace(/'[^']*'|"[^"]*"/g, '""')
    .replace(/\d?>&\d|[\d&]?>\s*\/dev\/null/g, '')
    .replace(/^\s*cd\s+[^&;|]+&&/, '')
  if (/[;&>`$]/.test(bare)) return 'tool'
  const words = bare.split('|').map(seg => seg.trim().split(/\s+/)[0] ?? '')
  return LOOK_CMDS.has(words[0] ?? '') && words.every(w => PIPE_CMDS.has(w)) ? 'reading' : 'tool'
}

const callAct = (e: { tool: string; command?: unknown }): Act =>
  e.tool === 'Bash' && typeof e.command === 'string' ? bashAct(e.command) : toolAct(e.tool)

const warned = new Set<string>()

type Reading = Pick<Meter, 'context' | 'rateLimits' | 'cost'>

let gen = 0

const newer = (old: number | null, cost: number | null) => (old != null && cost != null ? Math.max(old, cost) : cost)

let compactWindow: { model: string; tokens: number; auto: boolean } | null = null

async function fitContext($: EngineInterface, c: Meter['context']): Promise<Meter['context']> {
  if (!c) return c
  const model = await $.session.model()
  if (compactWindow?.model !== model) {
    const b = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
    const tokens = b?.autoCompactThreshold ?? b?.rawMaxTokens
    if (!tokens) return c
    compactWindow = { model, tokens, auto: !!b?.isAutoCompactEnabled && b.autoCompactThreshold !== undefined }
  }
  const { tokens: window, auto } = compactWindow
  if (window >= c.window) return { ...c, autoCompact: auto }
  return { ...c, window, autoCompact: auto, percent: c.tokens === undefined ? undefined : Math.min(100, Math.round((c.tokens / window) * 100)) }
}

async function setMeter($: EngineInterface, r: Reading) {
  const g = gen
  r = { ...r, context: await fitContext($, r.context) }
  const now = await $.clock.now()
  await update($, meter, old => {
    const base = { ...old.base }
    for (const l of r.rateLimits) {
      const b = base[l.kind]
      if (!b || b.resetsAt !== l.resetsAt || l.percentUsed < b.p) {
        base[l.kind] = { t: now, p: l.percentUsed, resetsAt: l.resetsAt }
      }
    }
    return { ...r, cost: g === gen ? newer(old.cost, r.cost) : old.cost, base }
  })
  if ((await $.session.surfaces()).includes('desktop')) for (const l of r.rateLimits) warn($, l)
}

function warn($: EngineInterface, l: Limit) {
  for (const at of [80, 95]) {
    const tag = `${l.kind}:${at}:${l.resetsAt ?? ''}`
    if (l.percentUsed >= at && !warned.has(tag)) {
      warned.add(tag)
      $.ui.toast(`${limitName(l)} 额度已用 ${l.percentUsed}%`)
    }
  }
}

type Call = { tool: string; agent?: string; input: string; act: Act; asking: boolean }

const calls = new Map<string, Call>()
const jobs = new Set<string>()
let base: Act = 'idle'
let compacting = 0
let epoch = 0
let inTurn = false
let stepActs: Act[] = []
let shown: Act | null = null
let queue: Promise<void> = Promise.resolve()
let nap: { cancel: () => void } | null = null
let recount: { cancel: () => void } | null = null

const argsKey = (v: unknown) =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x))

const current = (): Act => {
  const list = [...calls.values()]
  if (list.some(c => c.asking)) return 'waiting'
  if (compacting > 0) return 'compacting'
  return list.filter(c => !c.agent).at(-1)?.act ?? base
}

function refresh($: EngineInterface) {
  queue = queue
    .then(async () => {
      const next = current()
      if (next === shown) return
      await update($, act, () => next)
      shown = next
    })
    .catch(() => {
      shown = null
    })
  return queue
}

async function setBase($: EngineInterface, next: Act) {
  base = next
  await refresh($)
}

function scheduleNap($: EngineInterface) {
  nap?.cancel()
  nap = $.clock.after(SLEEP_AFTER, () => void setBase($, 'sleep'))
}

async function countHelpers($: EngineInterface) {
  const n = (await $.agent.list()).filter(a => a.status === 'running').length
  await update($, helpers, () => n)
}

async function countJobs($: EngineInterface) {
  await update($, chores, () => jobs.size)
}

function recountSoon($: EngineInterface) {
  recount?.cancel()
  recount = $.clock.after(2000, () => void countHelpers($))
}

async function reset($: EngineInterface) {
  epoch++
  base = 'idle'
  calls.clear()
  jobs.clear()
  compacting = 0
  inTurn = false
  stepActs = []
  shown = null
  await refresh($)
  await countJobs($)
  await countHelpers($)
  scheduleNap($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const g = gen
    const u = await $.session.usage()
    if (g === gen) await setMeter($, { context: u.context, rateLimits: u.rateLimits, cost: u.cost?.usd ?? null })
    await reset($)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await setMeter($, { context: e.context, rateLimits: e.rateLimits, cost: e.cost?.usd ?? null })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      gen++
      await update($, meter, m => ({ ...m, cost: null }))
      await reset($)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const { tool, tool_use_id, agentId, consent, ...args } = e
    const ep = epoch
    try {
      const a = callAct(e)
      if (!agentId) stepActs.push(a)
      calls.set(tool_use_id, { tool, agent: agentId, input: argsKey(args), act: a, asking: tool === 'AskUserQuestion' })
      await refresh($)
      const r = await next(e)
      if (!agentId && tool === 'Bash' && args.run_in_background === true && !('deny' in r) && !('isError' in r && r.isError) && ep === epoch) {
        jobs.add(tool_use_id)
        await countJobs($)
      }
      return r
    } finally {
      calls.delete(tool_use_id)
      await refresh($)
    }
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const key = argsKey(e.tool_input)
    const open = [...calls.values()].filter(c => c.tool === e.tool_name && c.agent === e.agent_id && !c.asking)
    const exact = open.filter(c => c.input === key)
    const hit = exact.length === 1 ? exact[0] : exact.length === 0 && open.length === 1 ? open[0] : undefined
    if (hit) {
      hit.asking = true
      await refresh($)
    }
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    if (e.agentId || e.trigger === 'precompute') return next(e)
    nap?.cancel()
    if (base === 'sleep') base = 'idle'
    const ep = epoch
    compacting++
    try {
      await refresh($)
      return await next(e)
    } finally {
      if (ep === epoch) {
        compacting--
        await refresh($)
        if (!inTurn) scheduleNap($)
      }
    }
  })

  on('classic.SubagentStart', async ($, e, next) => {
    const r = await next(e)
    await countHelpers($)
    recountSoon($)
    return r
  })

  on('classic.SubagentStop', async ($, e, next) => {
    const r = await next(e)
    await countHelpers($)
    recountSoon($)
    return r
  })

  on('classic.Stop', async ($, e, next) => {
    if (e.background_tasks && !e.background_tasks.some(t => t.type === 'shell')) {
      jobs.clear()
      await countJobs($)
    }
    await countHelpers($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') {
      const id = /<tool-use-id>([^<]+)<\/tool-use-id>/.exec(e.text)?.[1]
      if (id && jobs.delete(id)) await countJobs($)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    nap?.cancel()
    inTurn = true
    stepActs = []
    await setBase($, 'thinking')
    await countHelpers($)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    let mulling: Act = stepActs.length > 0 && stepActs.every(a => a === 'reading') ? 'reading' : 'thinking'
    stepActs = []
    await setBase($, mulling)
    for await (const c of next(e)) {
      if (c.kind === 'thinking') await setBase($, mulling)
      if (c.kind === 'tool' || c.kind === 'text') mulling = 'thinking'
      if (c.kind === 'tool') await setBase($, toolAct(c.name))
      if (c.kind === 'text') await setBase($, 'responding')
      yield c
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const g = gen
      const cost = (await $.session.usage()).cost?.usd ?? null
      await update($, meter, m => (g === gen ? { ...m, cost: newer(m.cost, cost) } : m))
      return next(e)
    }
    if (e.usage) {
      const at = await $.clock.now()
      const u = e.usage
      await update($, last, () => ({
        at,
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
        ms: e.durationMs,
      }))
    }
    inTurn = false
    await countHelpers($)
    await setBase($, e.reason === 'error' ? 'error' : e.reason === 'aborted' ? 'aborted' : 'idle')
    scheduleNap($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    const m = await read($, meter)
    const t = await read($, last)
    const a = await read($, act)
    const crew = await read($, helpers)
    const shells = await read($, chores)

    const { Box, Svg } = $.ui.resolve(e)
    const parts = bandParts(m, t, await $.clock.now(), e.props.isWorking, a, crew, shells)
    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" width="100%">
        {parts.map(p => (
          <Svg source={p.source} width={p.width} height={p.height} alt={p.alt} />
        ))}
      </Box>
    )
  })
}
