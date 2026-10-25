import { pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const masterEnum = pgEnum("master_name", ["Мария", "Вика", "Ира"]);

export const chairBookings = pgTable("chair_bookings", {
  id: serial("id").primaryKey(),
  master: masterEnum("master").notNull(),
  // Stored as plain "YYYY-MM-DD" / "HH:MM" strings to avoid timezone surprises.
  bookingDate: varchar("booking_date", { length: 10 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  note: varchar("note", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
