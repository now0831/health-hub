import { timingSafeEqual } from "node:crypto";

/** 동기화 앱 요청의 `Authorization: Bearer <SYNC_TOKEN>` 헤더를 검증한다 */
export function verifySyncToken(request: Request): boolean {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
