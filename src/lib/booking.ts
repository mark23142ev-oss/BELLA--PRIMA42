// Shared constants & helpers for the pedicure-chair booking app.

export const MASTERS = ["Мария", "Вика", "Ира"] as const;
export type Master = (typeof MASTERS)[number];

export function isMaster(value: unknown): value is Master {
  return typeof value === "string" && (MASTERS as readonly string[]).includes(value);
}

export const MASTER_STYLES: Record<
  Master,
  { bg: string; text: string; ring: string; dot: string; soft: string; border: string }
> = {
  Мария: {
    bg: "bg-pink-500",
    text: "text-pink-600",
    ring: "ring-pink-400",
    dot: "bg-pink-500",
    soft: "bg-pink-50",
    border: "border-pink-300",
  },
  Вика: {
    bg: "bg-violet-500",
    text: "text-violet-600",
    ring: "ring-violet-400",
    dot: "bg-violet-500",
    soft: "bg-violet-50",
    border: "border-violet-300",
  },
  Ира: {
    bg: "bg-teal-500",
    text: "text-teal-600",
    ring: "ring-teal-400",
    dot: "bg-teal-500",
    soft: "bg-teal-50",
    border: "border-teal-300",
  },
};

// Working hours for the shared chair.
export const WORK_START = "08:00";
export const WORK_END = "21:00";

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export { WEEKDAY_LABELS };

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
export { MONTH_NAMES };

export function buildMonthGrid(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first index: Sunday(0) -> 6, Monday(1) -> 0, ...
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -firstWeekday);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}

export function formatHumanDate(date: Date): string {
  const days = [
    "воскресенье",
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота",
  ];
  const dayName = days[date.getDay()];
  const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${dayNameCap}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()].toLowerCase()}`;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}
