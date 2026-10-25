import { db } from "@/db";
import { chairBookings } from "@/db/schema";
import {
  isMaster,
  isValidDateKey,
  isValidTime,
  rangesOverlap,
  timeToMinutes,
  WORK_END,
  WORK_START,
} from "@/lib/booking";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!isValidDateKey(date)) {
    return Response.json({ error: "Укажите корректную дату (date=YYYY-MM-DD)." }, { status: 400 });
  }

  const bookings = await db
    .select()
    .from(chairBookings)
    .where(eq(chairBookings.bookingDate, date))
    .orderBy(asc(chairBookings.startTime));

  return Response.json({ bookings });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const { master, bookingDate, startTime, endTime, note } = (body ?? {}) as Record<string, unknown>;

  if (!isMaster(master)) {
    return Response.json({ error: "Выберите мастера." }, { status: 400 });
  }
  if (!isValidDateKey(bookingDate)) {
    return Response.json({ error: "Укажите корректную дату." }, { status: 400 });
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return Response.json({ error: "Укажите корректное время." }, { status: 400 });
  }
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    return Response.json({ error: "Время окончания должно быть позже времени начала." }, { status: 400 });
  }
  if (timeToMinutes(startTime) < timeToMinutes(WORK_START) || timeToMinutes(endTime) > timeToMinutes(WORK_END)) {
    return Response.json(
      { error: `Кресло работает с ${WORK_START} до ${WORK_END}.` },
      { status: 400 },
    );
  }

  let cleanNote: string | null = null;
  if (typeof note === "string" && note.trim().length > 0) {
    cleanNote = note.trim().slice(0, 120);
  }

  const existing = await db
    .select()
    .from(chairBookings)
    .where(eq(chairBookings.bookingDate, bookingDate));

  const conflict = existing.find((b) => rangesOverlap(startTime, endTime, b.startTime, b.endTime));
  if (conflict) {
    return Response.json(
      {
        error: `Кресло уже занято: ${conflict.master} с ${conflict.startTime} до ${conflict.endTime}.`,
      },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(chairBookings)
    .values({
      master,
      bookingDate,
      startTime,
      endTime,
      note: cleanNote,
    })
    .returning();

  return Response.json({ booking: created }, { status: 201 });
}
