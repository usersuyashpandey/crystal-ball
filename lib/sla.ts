/**
 * Where an item stands against its review SLA at a given moment. Used by
 * the prompts (so the model never does date arithmetic) and by the detail
 * pane, so both always say the same thing.
 */
export function slaPosition(submittedAt: string, slaHours: number, now: Date = new Date()) {
  const hoursPending = (now.getTime() - new Date(submittedAt).getTime()) / 3_600_000;
  const hoursLeft = slaHours - hoursPending;
  return {
    hoursPending: Math.round(hoursPending),
    overdue: hoursLeft < 0,
    slaStatus: hoursLeft < 0 ? `overdue by ${Math.round(-hoursLeft)}h` : `due in ${Math.round(hoursLeft)}h`,
  };
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Sep 26" — fixed locale and time zone so server and browser render the
 * same string (no hydration mismatch). */
export function shortDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
