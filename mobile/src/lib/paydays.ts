import type { Frequency, Plan } from "../types";

/**
 * Payday dates are "YYYY-MM-DD" strings, worked out as whole days so time zones and daylight saving can't shift them.
 * The schedule counts forward from one known payday (the "next payday" picked on the Payday tab).
 */

const DAY = 86_400_000;

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};
const dayNum = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / DAY);
const fromDayNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** A day of the month, moved back to the month's last day when the month is shorter (the 31st in April is the 30th). */
const clampDay = (y: number, m: number, d: number) => dayNum(y, m, Math.min(d, lastDay(y, m)));

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

/** Today, or another moment, as "YYYY-MM-DD" in this device's time zone. */
export function toDate(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Moves a date by whole days or months. Months keep the day, or use the month's last day when it's shorter. */
export function addDays(s: string, days: number): string {
  const { y, m, d } = parse(s);
  return fromDayNum(dayNum(y, m, d) + days);
}
export function addMonths(s: string, months: number): string {
  const { y, m, d } = parse(s);
  const t = new Date(Date.UTC(y, m + months, 1));
  return fromDayNum(clampDay(t.getUTCFullYear(), t.getUTCMonth(), d));
}

/**
 * The two days of the month that twice-a-month pay lands on, from one payday. 31 means the month's last day.
 * The 15th or the last day gives the 15th and the last day; otherwise the two are 15 days apart (the 1st and 16th, the 5th and 20th).
 */
export function twiceMonthlyDays(anchor: string): [number, number] {
  const { y, m, d } = parse(anchor);
  if (d === 15 || d >= 30 || d === lastDay(y, m)) return [15, 31];
  if (d > 15) return [d - 15, d];
  return [d, d + 15 >= 30 ? 31 : d + 15];
}

/** The next `count` paydays on or after `from`, starting no earlier than the anchor payday. */
export function upcomingPaydays(anchor: string, frequency: Frequency, from: string, count: number): string[] {
  if (!isDate(anchor) || count <= 0) return [];
  const a = parse(anchor);
  const f = parse(from);
  const start = Math.max(dayNum(a.y, a.m, a.d), dayNum(f.y, f.m, f.d));
  const out: number[] = [];
  if (frequency === "weekly" || frequency === "biweekly") {
    const step = frequency === "weekly" ? 7 : 14;
    const first = dayNum(a.y, a.m, a.d);
    const k = Math.ceil((start - first) / step);
    for (let i = 0; i < count; i++) out.push(first + (k + i) * step);
  } else {
    const days = frequency === "monthly" ? [a.d] : twiceMonthlyDays(anchor);
    for (let i = 0; out.length < count && i < count * 2 + 2; i++) {
      const t = new Date(Date.UTC(a.y, a.m + i, 1));
      for (const d of days) {
        const n = clampDay(t.getUTCFullYear(), t.getUTCMonth(), d);
        if (n >= start && out.length < count) out.push(n);
      }
    }
  }
  return out.map(fromDayNum);
}

/**
 * The payday the schedule counts from: the one picked on the Payday tab, or else the last payday logged there.
 * Empty when neither exists yet.
 */
export function payAnchor(plan: Plan): string {
  if (plan.nextPayday && isDate(plan.nextPayday)) return plan.nextPayday;
  const last = plan.paydays.length ? Math.max(...plan.paydays.map((p) => p.date)) : null;
  return last === null ? "" : toDate(last);
}

export const nextPaydays = (plan: Plan, count: number, now = Date.now()) => upcomingPaydays(payAnchor(plan), plan.frequency, toDate(now), count);

/** Whether today is on the schedule and no payday has been logged today yet. */
export function isPaydayToday(plan: Plan, now = Date.now()): boolean {
  const today = toDate(now);
  if (nextPaydays(plan, 1, now)[0] !== today) return false;
  return !plan.paydays.some((p) => toDate(p.date) === today);
}

/** "Fri, Oct 31" */
export const shortDay = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

const icsDate = (s: string, hour: number) => `${s.replace(/-/g, "")}T${String(hour).padStart(2, "0")}0000`;

/** How a calendar repeats on one day of the month. Days past the 28th use the month's last day when it's shorter. */
const monthlyRule = (d: number) => (d >= 29 ? `FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: d - 27 }, (_, i) => 28 + i).join(",")};BYSETPOS=-1` : `FREQ=MONTHLY;BYMONTHDAY=${d}`);

/**
 * A calendar file with every payday as a repeating event and an alert at `hour`, for the home screen app,
 * which can't schedule notifications itself. Times have no time zone, so they stay at that hour wherever you are.
 */
export function paydayCalendar(anchor: string, frequency: Frequency, hour: number, from: string, stamp: string): string {
  const series: { first: string; rule: string }[] = [];
  if (frequency === "weekly" || frequency === "biweekly") series.push({ first: upcomingPaydays(anchor, frequency, from, 1)[0], rule: `FREQ=WEEKLY;INTERVAL=${frequency === "weekly" ? 1 : 2}` });
  else {
    const days = frequency === "monthly" ? [parse(anchor).d] : twiceMonthlyDays(anchor);
    for (const d of days) {
      const first = upcomingPaydays(anchor, frequency, from, 3).find((s) => {
        const p = parse(s);
        return d >= 29 ? p.d === Math.min(d, lastDay(p.y, p.m)) : p.d === d;
      });
      if (first) series.push({ first, rule: monthlyRule(d) });
    }
  }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PayCheck//Paydays//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  series.forEach((s, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:paycheck-payday-${i}-${stamp}@paycheck`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.first, hour)}`,
      "DURATION:PT15M",
      `RRULE:${s.rule}`,
      "SUMMARY:Payday",
      "DESCRIPTION:Open PayCheck and type in what you got paid to see where it goes.",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Payday",
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
