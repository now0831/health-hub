import { parseGarminFit } from "@health/ingest";
import { saveRecords } from "@/lib/persist";

/** Garmin Connect 에서 내보낸 .fit 파일 업로드 (여러 개 동시 가능) */
export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "files 필드에 .fit 파일을 첨부하세요." }, { status: 400 });
  }

  const results = [];
  for (const file of files) {
    try {
      const workouts = parseGarminFit(new Uint8Array(await file.arrayBuffer()));
      await saveRecords(workouts);
      results.push({ file: file.name, workouts: workouts.length });
    } catch (e) {
      results.push({ file: file.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ results });
}
