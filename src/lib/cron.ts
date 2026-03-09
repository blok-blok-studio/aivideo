/**
 * Parse a cron expression and calculate the next run time.
 * Supports: minute hour dayOfMonth month dayOfWeek
 */
export function getNextCronRun(cron: string, after: Date = new Date()): Date {
  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = cron.split(" ");

  const parseField = (expr: string, min: number, max: number): number[] => {
    const values: number[] = [];
    for (const part of expr.split(",")) {
      if (part === "*") {
        for (let i = min; i <= max; i++) values.push(i);
      } else if (part.includes("/")) {
        const [, step] = part.split("/");
        const s = parseInt(step);
        for (let i = min; i <= max; i += s) values.push(i);
      } else if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        for (let i = start; i <= end; i++) values.push(i);
      } else {
        values.push(parseInt(part));
      }
    }
    return values.sort((a, b) => a - b);
  };

  const minutes = parseField(minuteExpr, 0, 59);
  const hours = parseField(hourExpr, 0, 23);
  const doms = parseField(domExpr, 1, 31);
  const months = parseField(monthExpr, 1, 12);
  const dows = parseField(dowExpr, 0, 6);

  // Search forward from `after` up to 366 days
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(after);
  limit.setDate(limit.getDate() + 366);

  while (candidate < limit) {
    const month = candidate.getMonth() + 1;
    const dom = candidate.getDate();
    const dow = candidate.getDay();
    const hour = candidate.getHours();
    const minute = candidate.getMinutes();

    if (
      months.includes(month) &&
      doms.includes(dom) &&
      dows.includes(dow) &&
      hours.includes(hour) &&
      minutes.includes(minute)
    ) {
      return candidate;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: 24h from now
  const fallback = new Date(after);
  fallback.setDate(fallback.getDate() + 1);
  return fallback;
}
