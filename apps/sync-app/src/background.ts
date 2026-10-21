import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { checkMorningBriefing } from "./notifications";
import { runSync } from "./sync";

const TASK_NAME = "health-sync";

/** 최소 실행 간격(분). 실제 실행 시점은 Android 가 배터리 상황을 보고 정한다 */
const INTERVAL_MINUTES = 60;

// 앱이 꺼져 있어도 실행될 수 있도록 모듈 최상단(index.ts 에서 import)에서 정의해야 한다
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await runSync();
    // 새 수면·심박 데이터로 계산한 오늘의 코칭을 아침에 한 번 알림
    await checkMorningBriefing().catch(() => false);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enableBackgroundSync() {
  if (!(await TaskManager.isTaskRegisteredAsync(TASK_NAME))) {
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
  }
}

export async function isBackgroundSyncEnabled() {
  return TaskManager.isTaskRegisteredAsync(TASK_NAME);
}
