import '@fontsource/dseg7/classic-700.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScoreBox } from '@/components/score-box'
import { SettingsDialog } from '@/components/settings-dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  buildActions,
  buildScoreActions,
  findAction,
  loadBindings,
  reconcileBindings,
  saveBindings,
} from '@/lib/keybindings'
import {
  TEAM_LABELS,
  buildStages,
  loadSettings,
  saveSettings,
  type Settings,
  type Team,
} from '@/lib/settings'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'running' | 'paused' | 'finished'

function formatMs(ms: number): { mm: string; ss: string } {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return {
    mm: String(Math.floor(total / 60)).padStart(2, '0'),
    ss: String(total % 60).padStart(2, '0'),
  }
}

function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [bindings, setBindings] = useState(() => loadBindings(settings.scoreSteps))
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  // 開始前カウントダウン（3・2・1）を数えている最中かどうか
  const [leadIn, setLeadIn] = useState(false)
  const [blueScore, setBlueScore] = useState(0)
  const [redScore, setRedScore] = useState(0)
  const deadlineRef = useRef(0)

  const stages = useMemo(() => buildStages(settings), [settings])
  const actions = useMemo(() => buildActions(settings.scoreSteps), [settings.scoreSteps])
  const scoreActions = useMemo(() => buildScoreActions(settings.scoreSteps), [settings.scoreSteps])

  const [remaining, setRemaining] = useState(stages[0].durationMs)

  const stage = stages[Math.min(stageIndex, stages.length - 1)]
  const nextStage = stageIndex + 1 < stages.length ? stages[stageIndex + 1] : null
  const secondsLeft = Math.ceil(Math.max(0, remaining) / 1000)
  const { mm, ss } = formatMs(remaining)

  /** 指定した段階へ移動して待機させる。 */
  const goToStage = useCallback(
    (index: number) => {
      const target = stages[index]
      if (!target) return
      setStageIndex(index)
      setLeadIn(false)
      setRemaining(target.durationMs)
      setPhase('idle')
    },
    [stages],
  )

  /** 指定した段階を頭から始める。開始前カウントダウンがあればそこから。 */
  const startStage = useCallback(
    (index: number) => {
      const target = stages[index]
      if (!target) return
      const hasLeadIn = target.leadInMs > 0
      const first = hasLeadIn ? target.leadInMs : target.durationMs
      setStageIndex(index)
      setLeadIn(hasLeadIn)
      setRemaining(first)
      deadlineRef.current = performance.now() + first
      setPhase('running')
    },
    [stages],
  )

  const start = useCallback(() => {
    if (phase === 'running' || phase === 'finished') return
    if (phase === 'paused') {
      deadlineRef.current = performance.now() + remaining
      setPhase('running')
      return
    }
    startStage(stageIndex)
  }, [phase, remaining, stageIndex, startStage])

  const pause = useCallback(() => {
    if (phase !== 'running') return
    setRemaining(Math.max(0, deadlineRef.current - performance.now()))
    setPhase('paused')
  }, [phase])

  const toggle = useCallback(() => {
    if (phase === 'running') pause()
    else if (phase === 'finished') {
      if (nextStage) startStage(stageIndex + 1)
    } else start()
  }, [phase, nextStage, stageIndex, pause, start, startStage])

  /** 最初の段階に戻し、得点も0にする */
  const reset = useCallback(() => {
    goToStage(0)
    setBlueScore(0)
    setRedScore(0)
  }, [goToStage])

  const addScore = useCallback((team: Team, delta: number) => {
    const setter = team === 'blue' ? setBlueScore : setRedScore
    setter((value) => Math.max(0, value + delta))
  }, [])

  /** 設定を変えたら時間が変わるので、最初の段階から待機し直す */
  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    setBindings((current) => reconcileBindings(current, next.scoreSteps))
    setStageIndex(0)
    setLeadIn(false)
    setPhase('idle')
    setRemaining(buildStages(next)[0].durationMs)
  }, [])

  // 経過時間は開始時刻からの差分で求める（setInterval のずれを持ち越さない）
  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    const step = () => {
      const left = deadlineRef.current - performance.now()
      if (left <= 0) {
        if (leadIn) {
          // カウントダウンが終わったら、そのまま本編の計測へ切り替える
          deadlineRef.current += stage.durationMs
          setRemaining(stage.durationMs)
          setLeadIn(false)
          return
        }
        setRemaining(0)
        setPhase('finished')
        return
      }
      setRemaining(left)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, leadIn, stage])

  // 計測中は画面を消灯させない
  useEffect(() => {
    if (phase !== 'running' || !navigator.wakeLock) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    void navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (released) void lock.release()
        else sentinel = lock
      })
      .catch(() => {})
    return () => {
      released = true
      void sentinel?.release().catch(() => {})
    }
  }, [phase])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 設定中はキー割り当ての入力を邪魔しない
      if (settingsOpen) return
      // ボタンにフォーカスがある時は、そのボタン本来の操作を優先する
      if (event.target instanceof HTMLButtonElement) return

      const action = findAction(bindings, actions, event.key)
      if (!action) return
      event.preventDefault()
      if (action === 'toggle') toggle()
      else if (action === 'reset') reset()
      else {
        const scoreAction = scoreActions.find((item) => item.id === action)
        if (scoreAction) addScore(scoreAction.team, scoreAction.delta)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bindings, actions, scoreActions, settingsOpen, toggle, reset, addScore])

  useEffect(() => {
    saveBindings(bindings)
  }, [bindings])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <header className="flex flex-wrap items-center justify-center gap-3">
        {stages.length > 1 && (
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(stageIndex)}
            onValueChange={(value) => {
              if (value) goToStage(Number(value))
            }}
            disabled={phase === 'running'}
          >
            {stages.map((item, index) => (
              <ToggleGroupItem
                key={item.label}
                value={String(index)}
                onClick={(event) => event.currentTarget.blur()}
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </header>

      <div
        className={cn(
          'flex items-center gap-[0.08em] font-seg text-[min(23vw,34vh)] leading-none',
          phase === 'finished' && 'animate-blink',
        )}
        role="timer"
        aria-label={
          leadIn
            ? `${stage.label}開始まで ${secondsLeft}秒`
            : `${stage.label} 残り ${Math.floor(secondsLeft / 60)}分 ${secondsLeft % 60}秒`
        }
      >
        <span>{mm}</span>
        <span
          className={cn(
            'flex flex-col justify-center gap-[0.24em] px-[0.06em]',
            phase === 'running' && 'animate-blink',
          )}
          aria-hidden="true"
        >
          <i className="size-[0.11em] bg-current" />
          <i className="size-[0.11em] bg-current" />
        </span>
        <span>{ss}</span>
      </div>

      <ScoreBox
        label={TEAM_LABELS.blue}
        score={blueScore}
        accentClassName="bg-[#00f]"
        positionClassName="left-6"
      />
      <ScoreBox
        label={TEAM_LABELS.red}
        score={redScore}
        accentClassName="bg-[#f00]"
        positionClassName="right-6"
      />

      <SettingsDialog
        settings={settings}
        onSettingsChange={updateSettings}
        bindings={bindings}
        onBindingsChange={setBindings}
        open={settingsOpen}
        onOpenChange={(next) => {
          setSettingsOpen(next)
          // 閉じた後に設定ボタンへ戻るフォーカスを外す（Space で開き直さないように）
          if (!next) requestAnimationFrame(() => (document.activeElement as HTMLElement)?.blur())
        }}
      />
    </main>
  )
}

export default App
