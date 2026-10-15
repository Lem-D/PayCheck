import { describe, expect, it } from "@jest/globals";
import { emptyPlan } from "../types";
import { addMonths, isPaydayToday, payAnchor, paydayCalendar, twiceMonthlyDays, upcomingPaydays } from "./paydays";

const noon = (s: string) => new Date(`${s}T12:00:00`).getTime();

describe("upcomingPaydays", () => {
  it("steps every 2 weeks from the anchor, starting today when today is a payday", () => {
    expect(upcomingPaydays("2026-10-02", "biweekly", "2026-10-16", 3)).toEqual(["2026-10-16", "2026-10-30", "2026-11-13"]);
    expect(upcomingPaydays("2026-10-02", "biweekly", "2026-10-17", 1)).toEqual(["2026-10-30"]);
  });

  it("starts at a next payday that's still ahead, without counting back from it", () => {
    expect(upcomingPaydays("2026-11-06", "weekly", "2026-10-15", 2)).toEqual(["2026-11-06", "2026-11-13"]);
  });

  it("crosses daylight saving time without slipping a day", () => {
    expect(upcomingPaydays("2026-10-30", "weekly", "2026-10-30", 2)).toEqual(["2026-10-30", "2026-11-06"]);
    expect(upcomingPaydays("2027-03-05", "weekly", "2027-03-05", 2)).toEqual(["2027-03-05", "2027-03-12"]);
  });

  it("keeps the same day each month, using the last day in shorter months", () => {
    expect(upcomingPaydays("2027-01-31", "monthly", "2027-01-31", 4)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("pays twice a month on the 15th and the last day", () => {
    expect(upcomingPaydays("2026-10-15", "semimonthly", "2026-10-16", 4)).toEqual(["2026-10-31", "2026-11-15", "2026-11-30", "2026-12-15"]);
    expect(upcomingPaydays("2027-02-28", "semimonthly", "2027-02-28", 2)).toEqual(["2027-02-28", "2027-03-15"]);
  });

  it("pays twice a month 15 days apart otherwise", () => {
    expect(twiceMonthlyDays("2026-10-01")).toEqual([1, 16]);
    expect(twiceMonthlyDays("2026-10-20")).toEqual([5, 20]);
    expect(upcomingPaydays("2026-10-20", "semimonthly", "2026-10-21", 3)).toEqual(["2026-11-05", "2026-11-20", "2026-12-05"]);
  });
});

describe("payAnchor and isPaydayToday", () => {
  it("uses the picked payday, else the last logged one", () => {
    const logged = { ...emptyPlan(), paydays: [{ date: noon("2026-10-02"), pay: 1, spend: 0, saved: 1, moves: [], applied: false }] };
    expect(payAnchor(emptyPlan())).toBe("");
    expect(payAnchor(logged)).toBe("2026-10-02");
    expect(payAnchor({ ...logged, nextPayday: "2026-10-09" })).toBe("2026-10-09");
  });

  it("is payday until that day's payday is logged", () => {
    const plan = { ...emptyPlan(), nextPayday: "2026-10-16" };
    expect(isPaydayToday(plan, noon("2026-10-16"))).toBe(true);
    expect(isPaydayToday(plan, noon("2026-10-17"))).toBe(false);
    expect(isPaydayToday({ ...plan, paydays: [{ date: noon("2026-10-16"), pay: 1, spend: 0, saved: 1, moves: [], applied: false }] }, noon("2026-10-16"))).toBe(false);
  });
});

describe("addMonths", () => {
  it("uses the last day when the month is shorter", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2026-10-15", 12)).toBe("2027-10-15");
  });
});

describe("paydayCalendar", () => {
  it("repeats every 2 weeks with an alert at the hour", () => {
    const ics = paydayCalendar("2026-10-02", "biweekly", 9, "2026-10-15", "20261015T000000Z");
    expect(ics).toContain("DTSTART:20261016T090000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
    expect(ics).toContain("TRIGGER:PT0M");
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(1);
  });

  it("uses two monthly events for twice a month, the second on the last day", () => {
    const ics = paydayCalendar("2026-10-15", "semimonthly", 9, "2026-10-16", "20261016T000000Z");
    expect(ics).toContain("DTSTART:20261115T090000\r\nDURATION:PT15M\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15\r\n");
    expect(ics).toContain("DTSTART:20261031T090000\r\nDURATION:PT15M\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1\r\n");
  });
});
