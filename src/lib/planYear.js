// Returns { start: Date, end: Date } for the plan year containing `date`.
// Uses Client.plan_year_start (month/day) as the anniversary when set;
// falls back to the calendar year.
export function getPlanYearWindow(client, date) {
  const d = date ? new Date(date) : new Date();
  const anchor = client?.plan_year_start ? new Date(client.plan_year_start) : null;
  if (!anchor || isNaN(anchor)) {
    const start = new Date(d.getFullYear(), 0, 1);
    const end = new Date(d.getFullYear() + 1, 0, 1);
    return { start, end };
  }
  const m = anchor.getMonth();
  const day = anchor.getDate();
  let start = new Date(d.getFullYear(), m, day);
  if (start > d) start = new Date(d.getFullYear() - 1, m, day);
  const end = new Date(start.getFullYear() + 1, m, day);
  return { start, end };
}

export function planYearLabel(client, date) {
  return getPlanYearWindow(client, date).start.getFullYear();
}