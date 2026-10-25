import { db } from "@/db";
import { chairBookings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Некорректный идентификатор записи." }, { status: 400 });
  }

  const deleted = await db.delete(chairBookings).where(eq(chairBookings.id, id)).returning();

  if (deleted.length === 0) {
    return Response.json({ error: "Запись не найдена." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
