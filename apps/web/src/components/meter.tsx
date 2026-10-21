import type { ReactNode } from "react";

export type Tone = "accent" | "good" | "warning" | "serious" | "critical" | "muted";

const TONE_VAR: Record<Tone, string> = {
  accent: "var(--accent)",
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
  muted: "var(--muted)",
};

/**
 * 가로 막대 미터. 채움 색이 상태를 나타내고, 빈 부분은 같은 색의 옅은 단계로 칠해
 * 막대 전체에서 상태가 읽히게 한다.
 */
export function Meter({
  value,
  max = 100,
  tone = "accent",
  label,
  className = "h-2",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = TONE_VAR[tone];
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ background: `color-mix(in oklab, ${color} 18%, var(--surface))` }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const ICON: Record<Tone, string> = { good: "✓", warning: "!", serious: "▲", critical: "✕", accent: "•", muted: "–" };

/** 상태 색 + 아이콘 + 라벨 */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const color = TONE_VAR[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground"
      style={{ background: `color-mix(in oklab, ${color} 18%, var(--surface))` }}
    >
      <span aria-hidden style={{ color }}>
        {ICON[tone]}
      </span>
      {children}
    </span>
  );
}

/** 0~100 점수 → 상태 (회복 점수 구간과 같은 기준) */
export function scoreTone(score: number | null): Tone {
  if (score === null) return "muted";
  if (score >= 75) return "good";
  if (score >= 50) return "warning";
  if (score >= 25) return "serious";
  return "critical";
}
