"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDateKey,
  formatHumanDate,
  isSameDay,
  Master,
  MASTER_STYLES,
  MASTERS,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  WORK_END,
  WORK_START,
  minutesToTime,
  timeToMinutes,
} from "@/lib/booking";

type Booking = {
  id: number;
  master: Master;
  bookingDate: string;
  startTime: string;
  endTime: string;
  note: string | null;
  createdAt: string;
};

type SummaryItem = { bookingDate: string; master: Master };

const STORAGE_KEY = "pedicure-chair-master";

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function roundUpToQuarter(date: Date): Date {
  const copy = new Date(date);
  const minutes = copy.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  copy.setMinutes(rounded, 0, 0);
  return copy;
}

function defaultStartTime(): string {
  const now = roundUpToQuarter(new Date());
  let h = now.getHours();
  let m = now.getMinutes();
  if (h * 60 + m < timeToMinutes(WORK_START)) {
    return WORK_START;
  }
  if (h * 60 + m > timeToMinutes(WORK_END) - 30) {
    return minutesToTime(timeToMinutes(WORK_END) - 60);
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function BookingApp() {
  const [currentMaster, setCurrentMaster] = useState<Master | null>(null);
  const [masterLoaded, setMasterLoaded] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(() => todayStart());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = todayStart();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [summary, setSummary] = useState<Map<string, Set<Master>>>(new Map());

  const [modalOpen, setModalOpen] = useState(false);
  const [formMaster, setFormMaster] = useState<Master>("Мария");
  const [formStart, setFormStart] = useState(defaultStartTime());
  const [formEnd, setFormEnd] = useState(() =>
    minutesToTime(Math.min(timeToMinutes(defaultStartTime()) + 60, timeToMinutes(WORK_END))),
  );
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Load/save current master
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (MASTERS as readonly string[]).includes(saved)) {
        setCurrentMaster(saved as Master);
      }
    } catch {
      // ignore storage errors
    }
    setMasterLoaded(true);
  }, []);

  const chooseMaster = useCallback((m: Master) => {
    setCurrentMaster(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (currentMaster) setFormMaster(currentMaster);
  }, [currentMaster]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const dateKey = formatDateKey(selectedDate);

  const fetchDay = useCallback(async (key: string) => {
    setDayLoading(true);
    try {
      const res = await fetch(`/api/bookings?date=${key}`, { cache: "no-store" });
      const data = await res.json();
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch {
      setBookings([]);
    } finally {
      setDayLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (monthStart: Date) => {
    const gridStart = addDays(monthStart, -7);
    const gridEnd = addDays(monthStart, 41);
    const start = formatDateKey(gridStart);
    const end = formatDateKey(gridEnd);
    try {
      const res = await fetch(`/api/bookings/summary?start=${start}&end=${end}`, { cache: "no-store" });
      const data = await res.json();
      const map = new Map<string, Set<Master>>();
      if (Array.isArray(data.items)) {
        for (const item of data.items as SummaryItem[]) {
          if (!map.has(item.bookingDate)) map.set(item.bookingDate, new Set());
          map.get(item.bookingDate)!.add(item.master);
        }
      }
      setSummary(map);
    } catch {
      setSummary(new Map());
    }
  }, []);

  useEffect(() => {
    fetchDay(dateKey);
  }, [dateKey, fetchDay]);

  useEffect(() => {
    fetchSummary(viewMonth);
  }, [viewMonth, fetchSummary]);

  const monthCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const today = useMemo(() => todayStart(), []);

  function openAddModal() {
    setFormMaster(currentMaster ?? "Мария");
    const start = defaultStartTime();
    setFormStart(start);
    setFormEnd(minutesToTime(Math.min(timeToMinutes(start) + 60, timeToMinutes(WORK_END))));
    setFormNote("");
    setFormError(null);
    setModalOpen(true);
  }

  function applyPreset(minutes: number) {
    setFormEnd(minutesToTime(Math.min(timeToMinutes(formStart) + minutes, timeToMinutes(WORK_END))));
  }

  async function submitBooking() {
    setFormError(null);
    if (timeToMinutes(formStart) >= timeToMinutes(formEnd)) {
      setFormError("Время окончания должно быть позже времени начала.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master: formMaster,
          bookingDate: dateKey,
          startTime: formStart,
          endTime: formEnd,
          note: formNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Не удалось сохранить запись.");
        return;
      }
      setModalOpen(false);
      setToast(`Записано: ${formMaster}, ${formStart}–${formEnd}`);
      fetchDay(dateKey);
      fetchSummary(viewMonth);
    } catch {
      setFormError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBooking(b: Booking) {
    const ok = window.confirm(
      `Отменить запись?\n${b.master}, ${b.startTime}–${b.endTime}${b.note ? `\n${b.note}` : ""}`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/bookings/${b.id}`, { method: "DELETE" });
      if (res.ok) {
        setToast("Запись отменена");
        fetchDay(dateKey);
        fetchSummary(viewMonth);
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "Не удалось отменить запись");
      }
    } catch {
      setToast("Ошибка сети");
    }
  }

  const dayStartMin = timeToMinutes(WORK_START);
  const dayEndMin = timeToMinutes(WORK_END);
  const totalMin = dayEndMin - dayStartMin;

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let h = Math.ceil(dayStartMin / 60); h * 60 <= dayEndMin; h++) marks.push(h * 60);
    return marks;
  }, [dayStartMin, dayEndMin]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gradient-to-b from-pink-50 via-white to-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-pink-100 bg-white/90 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">💅 Педикюрное кресло</h1>
            <p className="text-xs text-slate-500">Общая запись для мастеров</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {MASTERS.map((m) => {
            const active = currentMaster === m;
            const styles = MASTER_STYLES[m];
            return (
              <button
                key={m}
                onClick={() => chooseMaster(m)}
                className={`flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition active:scale-95 ${
                  active
                    ? `${styles.bg} border-transparent text-white shadow-sm`
                    : `${styles.soft} ${styles.border} ${styles.text}`
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
        {masterLoaded && !currentMaster && (
          <p className="mt-2 text-center text-xs text-pink-500">
            Выберите, кто вы — это запомнится на телефоне
          </p>
        )}
      </header>

      <main className="px-4 pt-4">
        {/* Calendar */}
        <section className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <div className="flex items-center justify-between">
            <button
              aria-label="Предыдущий месяц"
              onClick={() => setViewMonth((d) => addMonths(d, -1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 active:scale-90"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-800">
              {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              aria-label="Следующий месяц"
              onClick={() => setViewMonth((d) => addMonths(d, 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 active:scale-90"
            >
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {monthCells.map(({ date, inMonth }) => {
              const key = formatDateKey(date);
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const mastersToday = summary.get(key);
              return (
                <button
                  key={key}
                  disabled={!inMonth}
                  onClick={() => setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
                  className={`relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm transition active:scale-90 ${
                    !inMonth
                      ? "text-transparent"
                      : isSelected
                        ? "bg-pink-500 font-semibold text-white shadow"
                        : isToday
                          ? "border border-pink-300 text-pink-600"
                          : "text-slate-700 hover:bg-pink-50"
                  }`}
                >
                  {inMonth ? date.getDate() : "·"}
                  {inMonth && mastersToday && mastersToday.size > 0 && (
                    <span className="absolute bottom-1 flex gap-[2px]">
                      {Array.from(mastersToday)
                        .slice(0, 3)
                        .map((m) => (
                          <span
                            key={m}
                            className={`block h-[4px] w-[4px] rounded-full ${
                              isSelected ? "bg-white" : MASTER_STYLES[m].dot
                            }`}
                          />
                        ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Day detail */}
        <section className="mt-4 rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-slate-900">{formatHumanDate(selectedDate)}</p>
              <p className="text-xs text-slate-400">
                Рабочее время кресла: {WORK_START}–{WORK_END}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(todayStart())}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95"
            >
              Сегодня
            </button>
          </div>

          {/* Timeline bar */}
          <div className="mt-4">
            <div className="relative h-10 w-full overflow-hidden rounded-xl bg-slate-100">
              {hourMarks.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-full w-px bg-slate-200"
                  style={{ left: `${((m - dayStartMin) / totalMin) * 100}%` }}
                />
              ))}
              {bookings.map((b) => {
                const left = ((timeToMinutes(b.startTime) - dayStartMin) / totalMin) * 100;
                const width = ((timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / totalMin) * 100;
                return (
                  <div
                    key={b.id}
                    className={`absolute top-0 h-full ${MASTER_STYLES[b.master].bg} opacity-90`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${b.master} ${b.startTime}-${b.endTime}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{WORK_START}</span>
              <span>{WORK_END}</span>
            </div>
          </div>

          {/* Bookings list */}
          <div className="mt-4 space-y-2">
            {dayLoading ? (
              <p className="py-6 text-center text-sm text-slate-400">Загрузка…</p>
            ) : bookings.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">На этот день записей ещё нет</p>
            ) : (
              bookings.map((b) => {
                const styles = MASTER_STYLES[b.master];
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between rounded-2xl border ${styles.border} ${styles.soft} px-3 py-2.5`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {b.startTime}–{b.endTime} · {b.master}
                        </p>
                        {b.note && <p className="text-xs text-slate-500">{b.note}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteBooking(b)}
                      aria-label="Отменить запись"
                      className="shrink-0 rounded-full p-2 text-slate-400 active:scale-90 active:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Все мастера видят общее расписание кресла в реальном времени.
        </p>
      </main>

      {/* Floating add button */}
      <button
        onClick={openAddModal}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-pink-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(236,72,153,0.4)] active:scale-95"
      >
        <span className="text-lg leading-none">＋</span> Добавить запись
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Add booking modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <h2 className="text-base font-semibold text-slate-900">Новая запись на кресло</h2>
            <p className="mb-4 text-xs text-slate-400">{formatHumanDate(selectedDate)}</p>

            <label className="mb-1 block text-xs font-medium text-slate-500">Мастер</label>
            <div className="mb-4 flex gap-2">
              {MASTERS.map((m) => {
                const active = formMaster === m;
                const styles = MASTER_STYLES[m];
                return (
                  <button
                    key={m}
                    onClick={() => setFormMaster(m)}
                    className={`flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition active:scale-95 ${
                      active ? `${styles.bg} border-transparent text-white` : `${styles.soft} ${styles.border} ${styles.text}`
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Начало</label>
                <input
                  type="time"
                  value={formStart}
                  step={900}
                  min={WORK_START}
                  max={WORK_END}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base text-slate-800 focus:border-pink-400 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Окончание</label>
                <input
                  type="time"
                  value={formEnd}
                  step={900}
                  min={WORK_START}
                  max={WORK_END}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base text-slate-800 focus:border-pink-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              {[30, 60, 90, 120].map((min) => (
                <button
                  key={min}
                  onClick={() => applyPreset(min)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95"
                >
                  {min} мин
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-500">Клиент / услуга (необязательно)</label>
            <input
              type="text"
              value={formNote}
              maxLength={120}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Например: Анна, педикюр"
              className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base text-slate-800 focus:border-pink-400 focus:outline-none"
            />

            {formError && <p className="mb-3 text-sm text-red-500">{formError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 active:scale-95"
              >
                Отмена
              </button>
              <button
                onClick={submitBooking}
                disabled={submitting}
                className="flex-1 rounded-xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-60"
              >
                {submitting ? "Сохранение…" : "Записать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
