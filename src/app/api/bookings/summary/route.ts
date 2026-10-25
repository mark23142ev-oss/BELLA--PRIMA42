import { db } from "@/db";
import { chairBookings } from "@/db/schema";
import { isValidDateKey } from "@/lib/booking";
import { and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!isValidDateKey(start) || !isValidDateKey(end)) {
    return Response.json(
      { error: "Укажите корректный диапазон (start=YYYY-MM-DD&end=YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      bookingDate: chairBookings.bookingDate,
      master: chairBookings.master,
    })
    .from(chairBookings)
    .where(and(gte(chairBookings.bookingDate, start), lte(chairBookings.bookingDate, end)));

  return Response.json({ items: rows });
}
