/** UTC基準で ISO week (月曜始まり) の "YYYY-Www" キーを返す。 */
export function isoWeekKey(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const target = new Date(date.getTime());
  // ISO 8601: 木曜日を含む週で年を決定する
  const dayNumber = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const weekNumber =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

/** 暦月の "YYYY-MM" キーを返す。 */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
