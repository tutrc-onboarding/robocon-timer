import { Plus, Settings as SettingsIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { buildActions, formatKey, type ActionId, type KeyBindings } from '@/lib/keybindings'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings'

type SettingsDialogProps = {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  bindings: KeyBindings
  onBindingsChange: (bindings: KeyBindings) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SecondsFieldProps = {
  label: string
  value: number
  min: number
  onChange: (value: number) => void
}

/** 秒数の入力欄。入力途中の空欄や不正な値は確定させない */
function SecondsField({ label, value, min, onChange }: SecondsFieldProps) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      {label}
      <Input
        type="number"
        min={min}
        className="w-28"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next) && next >= min) onChange(next)
        }}
      />
    </label>
  )
}

export function SettingsDialog({
  settings,
  onSettingsChange,
  bindings,
  onBindingsChange,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  // 「変更」を押した操作。次に押されたキーを割り当てる
  const [capturing, setCapturing] = useState<ActionId | null>(null)
  const actions = buildActions(settings.scoreSteps)
  const steps = settings.scoreSteps

  useEffect(() => {
    if (!capturing) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setCapturing(null)
        return
      }
      // 修飾キー単体は割り当てない
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const next = { ...bindings }
      // 既に使われているキーなら、その操作と入れ替える
      const conflict = actions.find(
        (action) => action.id !== capturing && (next[action.id] ?? '').toLowerCase() === key.toLowerCase(),
      )
      if (conflict) next[conflict.id] = bindings[capturing] ?? ''
      next[capturing] = key
      onBindingsChange(next)
      setCapturing(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturing, actions, bindings, onBindingsChange])

  const setSteps = (scoreSteps: number[]) => onSettingsChange({ ...settings, scoreSteps })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setCapturing(null)
        onOpenChange(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-lg" className="fixed top-6 right-6" aria-label="設定">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      {/* 説明文を置かないので、Radix の説明用 id 参照も外す */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">時間（秒）</h2>
            <SecondsField
              label="セッティングタイム"
              value={settings.settingSeconds}
              min={0}
              onChange={(settingSeconds) => onSettingsChange({ ...settings, settingSeconds })}
            />
            <SecondsField
              label="スタート前カウントダウン"
              value={settings.leadInSeconds}
              min={0}
              onChange={(leadInSeconds) => onSettingsChange({ ...settings, leadInSeconds })}
            />
            <SecondsField
              label="試合時間"
              value={settings.matchSeconds}
              min={1}
              onChange={(matchSeconds) => onSettingsChange({ ...settings, matchSeconds })}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">得点の刻み</h2>
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={step}
                  aria-label={`刻み ${index + 1}`}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value) || value <= 0) return
                    if (steps.some((other, i) => i !== index && other === value)) return
                    setSteps(steps.map((other, i) => (i === index ? value : other)))
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`刻み ${step} を削除`}
                  disabled={steps.length <= 1}
                  onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setSteps([...steps, Math.max(...steps) + 1])}
            >
              <Plus /> 刻みを追加
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">キー割り当て</h2>
            {actions.map((action) => (
              <div key={action.id} className="flex items-center justify-between gap-4">
                <span className="text-sm">{action.label}</span>
                <Button
                  variant={capturing === action.id ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-28"
                  onClick={() => setCapturing(action.id)}
                >
                  {capturing === action.id ? 'キーを押す…' : formatKey(bindings[action.id])}
                </Button>
              </div>
            ))}
          </section>
        </div>

        <Button variant="ghost" size="sm" onClick={() => onSettingsChange(DEFAULT_SETTINGS)}>
          初期設定に戻す
        </Button>
      </DialogContent>
    </Dialog>
  )
}
