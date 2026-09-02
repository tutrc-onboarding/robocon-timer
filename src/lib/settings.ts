export type Team = 'blue' | 'red'

export const TEAM_LABELS: Record<Team, string> = { blue: '青', red: '赤' }

export type Settings = {
  /** セッティングタイム（秒）。0 にすると段階ごと無くなる */
  settingSeconds: number
  /** 試合開始前のカウントダウン（秒）。0 なら押した瞬間に開始 */
  leadInSeconds: number
  /** 試合時間（秒） */
  matchSeconds: number
  /** 得点の刻み */
  scoreSteps: number[]
}

export const DEFAULT_SETTINGS: Settings = {
  settingSeconds: 60,
  leadInSeconds: 3,
  matchSeconds: 180,
  scoreSteps: [1, 10],
}

export type Stage = {
  label: string
  durationMs: number
  /** 開始前カウントダウン */
  leadInMs: number
}

/** 設定から進行（段階の並び）を組み立てる */
export function buildStages(settings: Settings): Stage[] {
  const stages: Stage[] = []
  if (settings.settingSeconds > 0) {
    stages.push({
      label: 'セッティング',
      durationMs: settings.settingSeconds * 1000,
      leadInMs: 0,
    })
  }
  stages.push({
    label: '試合',
    durationMs: settings.matchSeconds * 1000,
    leadInMs: settings.leadInSeconds * 1000,
  })
  return stages
}

const STORAGE_KEY = 'robocon-timer:settings'

export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(saved)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const record = parsed as Record<string, unknown>
    const seconds = (key: keyof Settings, fallback: number) => {
      const value = record[key]
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
    }
    const steps = Array.isArray(record.scoreSteps)
      ? record.scoreSteps.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value) && value > 0,
        )
      : []
    return {
      settingSeconds: seconds('settingSeconds', DEFAULT_SETTINGS.settingSeconds),
      leadInSeconds: seconds('leadInSeconds', DEFAULT_SETTINGS.leadInSeconds),
      matchSeconds: Math.max(1, seconds('matchSeconds', DEFAULT_SETTINGS.matchSeconds)),
      scoreSteps: steps.length > 0 ? steps : DEFAULT_SETTINGS.scoreSteps,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 保存できなくても操作自体は続けられるので握りつぶす
  }
}
