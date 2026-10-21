import { db } from "@health/db";
import { verifySyncToken } from "@/lib/auth";

/** 잘못 기록한 세트 취소 */
export async function DELETE(request: Request, { params }: RouteContext<"/api/strength/[id]">) {
  if (!verifySyncToken(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { count } = await db.strengthSet.deleteMany({ where: { id } });
  return count > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "not found" }, { status: 404 });
}
