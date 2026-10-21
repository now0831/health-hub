import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput } from "react-native";
import { openHealthConnectSettings } from "react-native-health-connect";
import { enableBackgroundSync, isBackgroundSyncEnabled } from "../background";
import { getLastSyncAt, loadConfig, saveConfig } from "../config";
import { checkHealthConnect, type HealthConnectStatus, requestReadPermissions } from "../healthConnect";
import { refreshMedicationReminders } from "../notifications";
import { runSync, type SyncResult } from "../sync";
import { Button, Section, styles, usePalette } from "../ui";

export function SettingsScreen() {
  const c = usePalette();

  const [serverUrl, setServerUrl] = useState("");
  const [syncToken, setSyncToken] = useState("");
  const [hcStatus, setHcStatus] = useState<HealthConnectStatus | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [background, setBackground] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    (async () => {
      const config = await loadConfig();
      if (config) {
        setServerUrl(config.serverUrl);
        setSyncToken(config.syncToken);
      }
      setHcStatus(await checkHealthConnect());
      setLastSyncAt(await getLastSyncAt());
      setBackground(await isBackgroundSyncEnabled());
    })();
  }, []);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage((await fn()) ?? `${label} 완료`);
    } catch (e) {
      setMessage(`${label} 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const syncNow = () =>
    run("동기화", async () => {
      const r = await runSync();
      setResult(r);
      setLastSyncAt(await getLastSyncAt());
      return `동기화 완료: ${r.inserted}건 저장, ${r.skipped}건 중복`;
    });

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.sub, { color: c.muted }]}>
        가민·앳플리 데이터를 Health Connect 에서 읽어 내 홈페이지로 보냅니다.
      </Text>

      {hcStatus && hcStatus !== "available" && (
        <Text style={[styles.warn]}>
          {hcStatus === "not-installed"
            ? "Health Connect 를 사용할 수 없습니다. Play 스토어에서 설치하세요."
            : "Health Connect 업데이트가 필요합니다."}
        </Text>
      )}

      <Section title="1. 서버 연결" c={c}>
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="서버 주소 (예: http://192.168.0.10:3000)"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          keyboardType="url"
          style={[styles.input, { color: c.fg, borderColor: c.line }]}
        />
        <TextInput
          value={syncToken}
          onChangeText={setSyncToken}
          placeholder="SYNC_TOKEN (.env 에 넣은 값)"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          secureTextEntry
          style={[styles.input, { color: c.fg, borderColor: c.line }]}
        />
        <Button label="저장" c={c} disabled={busy} onPress={() => run("저장", () => saveConfig({ serverUrl, syncToken }))} />
      </Section>

      <Section title="2. Health Connect 권한" c={c}>
        <Button
          label="읽기 권한 요청"
          c={c}
          disabled={busy || hcStatus !== "available"}
          onPress={() =>
            run("권한 요청", async () => {
              const granted = await requestReadPermissions();
              return `권한 ${granted.length}개 허용됨`;
            })
          }
        />
        <Button label="Health Connect 설정 열기" c={c} secondary onPress={() => openHealthConnectSettings()} />
      </Section>

      <Section title="3. 동기화" c={c}>
        <Text style={{ color: c.muted }}>
          마지막 동기화: {lastSyncAt ? lastSyncAt.toLocaleString("ko-KR") : "없음"}
        </Text>
        <Button label="지금 동기화" c={c} disabled={busy} onPress={syncNow} />
        <Button
          label={background ? "자동 동기화 켜짐 (약 1시간마다)" : "자동 동기화 켜기"}
          c={c}
          secondary
          disabled={busy || background}
          onPress={() =>
            run("자동 동기화 설정", async () => {
              await enableBackgroundSync();
              setBackground(true);
            })
          }
        />
      </Section>

      <Section title="4. 복약 알림" c={c}>
        <Button
          label="알림 새로고침"
          c={c}
          secondary
          disabled={busy}
          onPress={() => run("알림 등록", async () => `복약 알림 ${await refreshMedicationReminders()}개 등록`)}
        />
      </Section>

      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
      {message && <Text style={[styles.message, { color: c.fg }]}>{message}</Text>}

      {result && result.origins.length > 0 && (
        <Section title="데이터를 보낸 앱 (출처)" c={c}>
          {/* 앳플리 앱의 패키지명을 확인해 packages/ingest/src/dedupe.ts 의 우선순위에 넣으세요 */}
          {result.origins.map((o) => (
            <Text key={o} style={{ color: c.muted, fontFamily: "monospace", fontSize: 12 }}>
              {o}
            </Text>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}
