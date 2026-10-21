# 기기 연동 설정

```
포러너 165 ──▶ Garmin Connect 앱 ──┐
                                    ├──▶ Health Connect ──▶ 동기화 앱(apps/sync-app) ──▶ 웹 서버 /api/sync
앳플리 TX ──▶ 앳플리 앱 ───────────┘
포러너 165 ──▶ FIT 파일 내보내기 ───────────────────────────▶ 웹 /exercise 에서 업로드 (GPS 경로·랩)
```

## 1. Health Connect

Android 14 이상은 시스템에 내장돼 있습니다 (설정 → 보안 및 개인정보 보호 → 개인정보 보호 → Health Connect).
Android 13 이하는 Play 스토어에서 "Health Connect" 앱을 설치하세요.

## 2. 가민 포러너 165 → Health Connect

1. Garmin Connect 앱을 최신 버전으로 업데이트 (5.14.1 이상, Android 14 이상 필요)
2. Garmin Connect → 더보기 → 설정 → **Health Connect** → 연결 및 권한 허용
3. 보내지는 항목: 걸음 수, 거리, 오른 층수, 칼로리, 심박수, 수면, 체중·체지방
4. GPS 경로와 랩은 Health Connect 로 넘어가지 않으므로, 상세 분석이 필요한 러닝은 FIT 파일로 올립니다.
   Garmin Connect **웹** → 활동 → 해당 활동 → 설정(⚙) → "원본 내보내기" → zip 안의 `.fit` 파일

> 같은 러닝이 Health Connect 와 FIT 으로 두 번 들어와도, 시작 시각이 2분 안쪽이면 하나로 합쳐집니다
> (`apps/web/src/lib/persist.ts`).

## 3. 앳플리 TX → Health Connect

1. 앳플리 앱에서 체중계 펌웨어를 최신으로 업데이트
2. 앳플리 앱의 Health Connect 연동 메뉴에서 연결 ([공식 안내](https://appservice.oopy.io/datalinking_android))
3. **삼성헬스에도 연결돼 있다면** 같은 체중이 두 번 들어옵니다. 둘 중 하나만 연결하거나,
   `packages/ingest/src/dedupe.ts` 의 `SOURCE_PRIORITY` 에 앳플리 앱 패키지명을 맨 앞에 넣으세요.
   패키지명은 동기화 앱에서 동기화한 뒤 화면 아래 "데이터를 보낸 앱" 목록에서 확인할 수 있습니다.

## 4. 동기화 앱 설치

Health Connect 는 Expo Go 에서 동작하지 않으므로 개발 빌드가 필요합니다.

### 방법 A — EAS 클라우드 빌드 (추천)

PC 에 Android SDK 를 설치하지 않아도 됩니다.

```bash
cd apps/sync-app
npx eas-cli login
npx eas-cli build --profile development --platform android
# 완료되면 나오는 링크/QR 로 휴대폰에 APK 설치
npx expo start --dev-client
```

### 방법 B — 로컬 빌드

Android Studio(SDK)와 JDK 17 이 필요합니다.

```bash
cd apps/sync-app
npx expo run:android
```

> ⚠️ **프로젝트 경로에 한글(`건강관리`)이 있으면 Windows 에서 Gradle 빌드가 실패할 수 있습니다.**
> 로컬 빌드를 하려면 프로젝트를 영문 경로(예: `C:\dev\health-hub`)로 옮기거나,
> `subst H: "C:\Users\...\건강관리"` 로 가상 드라이브를 만든 뒤 `H:\apps\sync-app` 에서 빌드하세요.
> EAS 클라우드 빌드(방법 A)는 이 문제가 없습니다.

### 앱 설정

1. **서버 주소**: PC 와 휴대폰이 같은 와이파이에 있을 때 `http://<PC의 IP>:3000`
   (PC IP 확인: PowerShell 에서 `ipconfig` → IPv4 주소. Windows 방화벽에서 3000 포트 허용 필요)
2. **SYNC_TOKEN**: 루트 `.env` 에 넣은 값과 동일하게
3. "읽기 권한 요청" → 모든 항목 허용 (백그라운드 읽기, 과거 데이터 읽기 포함)
4. "지금 동기화" → 처음에는 최근 90일을 가져옵니다
5. "자동 동기화 켜기" → 이후 약 1시간마다 Android 가 알아서 실행

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| `토큰이 서버의 SYNC_TOKEN 과 다릅니다` | 앱에 입력한 토큰과 `.env` 의 `SYNC_TOKEN` 이 같은지 |
| `Network request failed` | 서버 주소가 `localhost` 가 아닌 PC IP 인지, 방화벽, 같은 와이파이인지 |
| 가민 데이터가 안 들어옴 | Health Connect 앱 → 앱 권한 → Garmin Connect 에 쓰기 권한이 있는지 |
| 30일보다 오래된 데이터가 없음 | Health Connect 에서 동기화 앱의 "과거 데이터 읽기" 권한 허용 |
