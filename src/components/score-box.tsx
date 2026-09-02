import { cn } from '@/lib/utils'

type ScoreBoxProps = {
  /** 読み上げ用のチーム名。画面には出さない */
  label: string
  score: number
  /** 塗りつぶしの色（Tailwind のクラス） */
  accentClassName: string
  positionClassName: string
}

/** 得点ボックス。操作はキーボードから。 */
export function ScoreBox({ label, score, accentClassName, positionClassName }: ScoreBoxProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 px-6 py-4 text-white',
        accentClassName,
        positionClassName,
      )}
    >
      <span className="sr-only">{label}</span>
      {/* 3桁分の幅を確保して、桁が増えても箱の大きさが変わらないようにする */}
      <span className="inline-block w-[3ch] text-center font-seg text-[min(9vw,14vh)] leading-none">
        {score}
      </span>
    </div>
  )
}
