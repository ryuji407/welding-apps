import { format, differenceInDays, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { MaintenanceDueStatus } from '../types/maintenance'

export function formatDate(date: Date): string {
  return format(date, 'yyyy年M月d日', { locale: ja })
}

export function formatDateTime(date: Date): string {
  return format(date, 'yyyy年M月d日 HH:mm', { locale: ja })
}

export function formatDateTimeShort(date: Date): string {
  return format(date, 'M/d HH:mm', { locale: ja })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}時間${m}分` : `${h}時間`
}

export function calcNextDueDate(lastPerformedAt: Date, intervalDays: number): Date {
  return addDays(lastPerformedAt, Number(intervalDays))
}

export function calcDaysUntilDue(nextDueDate: Date): number {
  return differenceInDays(nextDueDate, new Date())
}

export function getDueStatus(daysUntilDue: number | null): MaintenanceDueStatus {
  if (daysUntilDue === null) return 'unknown'
  if (daysUntilDue <= 0) return 'overdue'
  if (daysUntilDue <= 7) return 'soon'
  return 'ok'
}

export function toDatetimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}
