import { EXERCISES, isExerciseKey, type ExerciseKey, type SetTarget } from "@health/coach";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { deleteSet, getToday, getTodaySets, logSet, type LoggedSet, type TodayResponse } from "../api";
import { Button, scoreColor, Section, styles, usePalette, type Palette } from "../ui";

const BAND_LABELS: Record<string, string> = { prime: "최상", high: "좋음", moderate: "보통", low: "낮음", poor: "매우 낮음" };

export function TodayScreen() {
  const c = usePalette();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 계획에 없지만 직접 추가한 운동 */
  const [added, setAdded] = useState<ExerciseKey[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, s] = await Promise.all([getToday(), getTodaySets()]);
      setToday(t);
      setSets(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 아침 코칭 알림을 띄우려면 Android 13+ 에서 알림 권한이 필요하다
    Notifications.requestPermissionsAsync().catch(() => undefined);
  }, [load]);

  const plan = today?.plan;
  const planned = plan?.strength ?? [];
  const extra = [...new Set([...added, ...sets.map((s) => s.exercise)])].filter(
    (k): k is ExerciseKey => isExerciseKey(k) && !planned.some((t) => t.exercise === k),
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {error && <Text style={styles.warn}>{error}</Text>}
      {!today && loading && <ActivityIndicator />}

      {today && plan && (
        <>
          <Section title="회복 점수" c={c}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <Text style={{ fontSize: 56, fontWeight: "700", color: c.fg, lineHeight: 60 }}>{today.readiness.score}</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: scoreColor(today.readiness.score), paddingBottom: 8 }}>
                ● {BAND_LABELS[today.readiness.band] ?? today.readiness.band}
              </Text>
            </View>
          </Section>

          <Section title="오늘의 운동" c={c}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: c.fg }}>{plan.title}</Text>
            <Text style={{ color: c.muted }}>{plan.summary}</Text>
            {plan.intensityGuide ? <Text style={{ color: c.fg }}>강도 · {plan.intensityGuide}</Text> : null}
            {plan.steps.map((s, i) => (
              <Text key={i} style={{ color: c.muted }}>
                <Text style={{ color: c.fg, fontWeight: "600" }}>{s.label}</Text>  {s.detail}
              </Text>
            ))}
            {plan.notes.map((n) => (
              <Text key={n} style={{ color: c.muted, fontSize: 12 }}>
                ⚠ {n}
              </Text>
            ))}
          </Section>

          {planned.map((t) => (
            <ExerciseLogger key={t.exercise} target={t} sets={sets} c={c} onChange={setSets} />
          ))}
          {extra.map((k) => (
            <ExerciseLogger key={k} target={{ exercise: k, sets: 0, weightKg: 0, reps: EXERCISES[k].repRange[0], reason: "" }} sets={sets} c={c} onChange={setSets} />
          ))}
          <AddExercise c={c} exclude={[...planned.map((t) => t.exercise), ...extra]} onAdd={(k) => setAdded((a) => [...a, k])} />

          {today.nutrition && (
            <Section title="오늘 식단" c={c}>
              <Text style={{ color: c.fg }}>
                {Math.round(today.nutrition.eaten.kcal)} / {today.nutrition.targets.kcal} kcal · 단백질 {Math.round(today.nutrition.eaten.proteinG)} /{" "}
                {today.nutrition.targets.proteinG}g
              </Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>식단 기록은 웹의 &quot;식단&quot; 메뉴에서 할 수 있습니다.</Text>
            </Section>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ExerciseLogger({ target, sets, c, onChange }: { target: SetTarget; sets: LoggedSet[]; c: Palette; onChange: (s: LoggedSet[]) => void }) {
  const ex = EXERCISES[target.exercise];
  const timed = "timed" in ex && ex.timed;
  const done = sets.filter((s) => s.exercise === target.exercise);
  const last = done.at(-1);
  const [weight, setWeight] = useState(last?.weightKg ?? target.weightKg);
  const [reps, setReps] = useState(last?.reps ?? target.reps);
  const [busy, setBusy] = useState(false);
  const step = ex.equipment === "dumbbell" ? 2.5 : 0;

  async function complete() {
    setBusy(true);
    try {
      const s = await logSet({ exercise: target.exercise, weightKg: weight, reps });
      onChange([...sets, s]);
    } finally {
      setBusy(false);
    }
  }
  async function undo(id: string) {
    await deleteSet(id);
    onChange(sets.filter((s) => s.id !== id));
  }

  const finished = target.sets > 0 && done.length >= target.sets;
  return (
    <Section title={`${ex.name}${target.sets ? `  ${done.length}/${target.sets}세트` : ""}${finished ? " ✓" : ""}`} c={c}>
      {target.reason ? <Text style={{ color: c.accent, fontSize: 12 }}>{target.reason}</Text> : null}
      <Text style={{ color: c.muted, fontSize: 12 }}>{ex.cue}</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {step > 0 && <Stepper label="무게 kg" value={weight} step={step} min={0} onChange={setWeight} c={c} />}
        <Stepper label={timed ? "초" : "반복"} value={reps} step={timed ? 5 : 1} min={1} onChange={setReps} c={c} />
      </View>
      <Button label={busy ? "기록 중…" : "세트 완료"} c={c} disabled={busy} onPress={complete} />
      {done.map((s, i) => (
        <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: c.fg }}>
            {i + 1}세트 · {s.weightKg > 0 ? `${s.weightKg}kg × ` : ""}
            {s.reps}
            {timed ? "초" : "회"}
          </Text>
          <Pressable onPress={() => undo(s.id)}>
            <Text style={{ color: c.muted }}>취소</Text>
          </Pressable>
        </View>
      ))}
    </Section>
  );
}

function Stepper({ label, value, step, min, onChange, c }: { label: string; value: number; step: number; min: number; onChange: (v: number) => void; c: Palette }) {
  const btn = { borderWidth: 1, borderColor: c.line, borderRadius: 8, width: 40, height: 40, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Pressable style={btn} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={{ color: c.fg, fontSize: 18 }}>−</Text>
        </Pressable>
        <Text style={{ color: c.fg, fontSize: 20, fontWeight: "600", minWidth: 48, textAlign: "center" }}>{value}</Text>
        <Pressable style={btn} onPress={() => onChange(value + step)}>
          <Text style={{ color: c.fg, fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 계획에 없는 운동을 골라 기록 목록에 추가 */
function AddExercise({ c, exclude, onAdd }: { c: Palette; exclude: ExerciseKey[]; onAdd: (k: ExerciseKey) => void }) {
  const [open, setOpen] = useState(false);
  const options = (Object.keys(EXERCISES) as ExerciseKey[]).filter((k) => !exclude.includes(k));
  if (!open) return <Button label="다른 운동 기록하기" c={c} secondary onPress={() => setOpen(true)} />;
  return (
    <Section title="운동 추가" c={c}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              onAdd(k);
              setOpen(false);
            }}
            style={{ borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: c.fg, fontSize: 13 }}>{EXERCISES[k].name}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}
