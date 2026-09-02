import { TEAM_LABELS, type Team } from '@/lib/settings'

export type ActionId = string
export type KeyBindings = Record<ActionId, string>

export type Action = { id: ActionId; label: string }
export type ScoreAction = Action & {
  team: Team
  /** 1回の操作で動かす点数（減点は負） */
  delta: number
}

const TEAMS: Team[] = ['blue', 'red']

/** タイマー側の操作 */
export const CONTROL_ACTIONS: Action[] = [
  { id: 'toggle', label: '開始 / 一時停止 / 次へ' },
  { id: 'reset', label: 'リセット' },
]

const CONTROL_DEFAULTS: KeyBindings = {
  toggle: ' ',
  reset: 'r',
}

/** 刻みが増えたときの既定キー。左手＝青 / 右手＝赤、上段が加点・下段が減点 */
const DEFAULT_KEY_PAIRS: Record<Team, string[][]> = {
  blue: [
    ['a', 'z'],
    ['s', 'x'],
    ['d', 'c'],
  ],
  red: [
    ['k', 'm'],
    ['l', ','],
    [';', '.'],
  ],
}

/** 刻みの一覧から得点操作を組み立てる */
export function buildScoreActions(steps: number[]): ScoreAction[] {
  return TEAMS.flatMap((team) =>
    steps.flatMap((step) => [
      { id: `${team}:+${step}`, team, delta: step, label: `${TEAM_LABELS[team]} +${step}` },
      { id: `${team}:-${step}`, team, delta: -step, label: `${TEAM_LABELS[team]} −${step}` },
    ]),
  )
}

export function buildActions(steps: number[]): Action[] {
  return [...CONTROL_ACTIONS, ...buildScoreActions(steps)]
}

export function buildDefaultBindings(steps: number[]): KeyBindings {
  const bindings: KeyBindings = { ...CONTROL_DEFAULTS }
  for (const team of TEAMS) {
    steps.forEach((step, index) => {
      // 用意した既定キーを使い切ったら未設定にする（設定画面から割り当てる）
      const [plus = '', minus = ''] = DEFAULT_KEY_PAIRS[team][index] ?? []
      bindings[`${team}:+${step}`] = plus
      bindings[`${team}:-${step}`] = minus
    })
  }
  return bindings
}

/** 刻みを変えたときに、残る操作の割り当てはそのまま、増えた分は既定値で埋める */
export function reconcileBindings(bindings: KeyBindings, steps: number[]): KeyBindings {
  const next = buildDefaultBindings(steps)
  for (const { id } of buildActions(steps)) {
    if (id in bindings) next[id] = bindings[id]
  }
  return next
}

const BINDINGS_KEY = 'robocon-timer:keybindings'

function readJson(key: string): unknown {
  try {
    const saved = localStorage.getItem(key)
    return saved === null ? null : JSON.parse(saved)
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できなくても操作自体は続けられるので握りつぶす
  }
}

export function loadBindings(steps: number[]): KeyBindings {
  const parsed = readJson(BINDINGS_KEY)
  const bindings = buildDefaultBindings(steps)
  if (typeof parsed !== 'object' || parsed === null) return bindings
  // 保存後に刻みを変えても壊れないよう、今ある操作だけ拾う
  for (const { id } of buildActions(steps)) {
    const key = (parsed as Record<string, unknown>)[id]
    if (typeof key === 'string') bindings[id] = key
  }
  return bindings
}

export function saveBindings(bindings: KeyBindings): void {
  writeJson(BINDINGS_KEY, bindings)
}

/** キーを画面表示用の文字列にする */
export function formatKey(key: string | undefined): string {
  if (!key) return '未設定'
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

/** 押されたキーから対応する操作を探す */
export function findAction(bindings: KeyBindings, actions: Action[], key: string): ActionId | null {
  const pressed = key.toLowerCase()
  for (const { id } of actions) {
    const bound = bindings[id]
    if (bound && bound.toLowerCase() === pressed) return id
  }
  return null
}
