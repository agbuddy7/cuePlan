import { dateSchema } from './schema.js';

export function dayNumber(date: string): number {
  return Date.parse(dateSchema.parse(date) + 'T00:00:00Z') / 86400000;
}
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}
export function shiftDate(date: string, delta: number): string {
  return new Date((dayNumber(date) + delta) * 86400000).toISOString().slice(0, 10);
}
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
