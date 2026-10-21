"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { file: string; workouts?: number; error?: string };

export function FitUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    try {
      const res = await fetch("/api/import/fit", { method: "POST", body: form });
      const body = (await res.json()) as { results?: Result[]; error?: string };
      setResults(body.results ?? [{ file: "-", error: body.error ?? `HTTP ${res.status}` }]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        {busy ? "업로드 중…" : ".fit 파일 업로드"}
        <input
          type="file"
          accept=".fit"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => upload(e.currentTarget.files)}
        />
      </label>
      <p className="mt-2 text-xs text-muted">
        Garmin Connect 웹 → 활동 상세 → 설정(⚙) → &ldquo;원본 내보내기&rdquo; 로 받은 파일. GPS 경로와 랩 기록이 추가됩니다.
      </p>
      {results.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.file} className={r.error ? "text-red-600" : "text-muted"}>
              {r.file}: {r.error ?? `운동 ${r.workouts}건 저장`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
