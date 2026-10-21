import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeMeasurements, SOURCES } from "./dedupe.ts";
import { fromHealthConnect } from "./health-connect.ts";

const meta = (id: string, dataOrigin: string = SOURCES.garminConnect) => ({ id, dataOrigin });

test("Weight 레코드를 kg 측정값으로 변환", () => {
  const [m] = fromHealthConnect("Weight", {
    metadata: meta("w1", SOURCES.samsungHealth),
    time: "2026-10-21T07:00:00Z",
    weight: { inKilograms: 72.4, inGrams: 72400 },
  });
  assert.deepEqual(m, {
    kind: "measurement",
    metric: "weight",
    value: 72.4,
    unit: "kg",
    measuredAt: new Date("2026-10-21T07:00:00Z"),
    source: SOURCES.samsungHealth,
    externalId: "w1",
  });
});

test("HeartRate 샘플마다 고유한 externalId 부여", () => {
  const out = fromHealthConnect("HeartRate", {
    metadata: meta("hr1"),
    startTime: "2026-10-21T07:00:00Z",
    endTime: "2026-10-21T07:02:00Z",
    samples: [
      { time: "2026-10-21T07:00:00Z", beatsPerMinute: 60 },
      { time: "2026-10-21T07:01:00Z", beatsPerMinute: 62 },
    ],
  });
  assert.equal(out.length, 2);
  assert.notEqual(out[0]!.externalId, out[1]!.externalId);
});

test("값이 없는 레코드는 버림", () => {
  assert.deepEqual(fromHealthConnect("Steps", { metadata: meta("s1"), endTime: "2026-10-21T07:00:00Z" }), []);
});

test("SleepSession 단계 상수를 이름으로 변환", () => {
  const [s] = fromHealthConnect("SleepSession", {
    metadata: meta("sl1"),
    startTime: "2026-10-20T15:00:00Z",
    endTime: "2026-10-20T22:00:00Z",
    stages: [{ startTime: "2026-10-20T15:00:00Z", endTime: "2026-10-20T16:00:00Z", stage: 5 }],
  });
  assert.equal(s!.kind, "sleep");
  assert.equal(s!.kind === "sleep" && s!.stages[0]!.stage, "deep");
});

test("같은 시각 체중이 두 출처에서 오면 우선순위 높은 것만 남김", () => {
  const a = fromHealthConnect("Weight", {
    metadata: meta("a", SOURCES.garminConnect),
    time: "2026-10-21T07:00:00Z",
    weight: { inKilograms: 72.4 },
  });
  const b = fromHealthConnect("Weight", {
    metadata: meta("b", SOURCES.samsungHealth),
    time: "2026-10-21T07:00:30Z",
    weight: { inKilograms: 72.4 },
  });
  const out = dedupeMeasurements([...a, ...b]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source, SOURCES.samsungHealth);
});
