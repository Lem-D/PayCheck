/**
 * The browser and home screen versions can't schedule notifications without a server, so reminders there come from
 * your phone's calendar instead: PayCheck makes a calendar file with every payday and an alert.
 */
export const canNotify = false;

export const askToNotify = async () => false;
export const scheduleReminders = async (_dates: string[], _hour: number) => {};
export const cancelReminders = async () => {};

/** Downloads the calendar file. On an iPhone, Safari shows the paydays with "Add All" to put them in Calendar. */
export async function saveCalendar(ics: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "PayCheck paydays.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
