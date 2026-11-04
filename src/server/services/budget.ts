import type { Database } from '../../lib/db'
import { convertMinorUnits } from '../../lib/money'
import { crossRate, ensureRates, ratesMap, type Fetcher } from './currencies'
import { listCategories } from './categories'
import {
  listIncomeSources,
  nextArrival,
  periodArrivals,
} from './income-sources'
import { daysInMonth, occurrencesBetween, type CycleUnit } from './recurrence'
import { getSettings } from './settings'
import { listSubscriptions } from './subscriptions'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type BudgetPeriod = {
  start: Date
  end: Date
  anchored: boolean
}

/**
 * The day an anchored period starts in a given month. With weekend shifting
 * on, a Saturday or Sunday anchor moves back to the Friday before it — the
 * last day a bank moves money.
 */
function anchorStart(
  year: number,
  month: number,
  anchor: number,
  shiftWeekends: boolean,
): Date {
  const start = new Date(
    Date.UTC(year, month, Math.min(anchor, daysInMonth(year, month))),
  )
  if (!shiftWeekends) return start

  const weekday = start.getUTCDay()
  if (weekday === 6) return new Date(start.getTime() - MS_PER_DAY)
  if (weekday === 0) return new Date(start.getTime() - 2 * MS_PER_DAY)
  return start
}

/** A month as a single number, so boundaries can cross year edges. */
function anchorStartAt(
  months: number,
  anchor: number,
  shiftWeekends: boolean,
): Date {
  const year = Math.floor(months / 12)
  return anchorStart(year, months - year * 12, anchor, shiftWeekends)
}

export function getBudgetPeriod(
  now: Date,
  payAnchorDay: number | null,
  shiftWeekends = false,
): BudgetPeriod {
  const anchor = payAnchorDay && payAnchorDay > 1 ? payAnchorDay : null
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  if (anchor === null) {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 0)),
      anchored: false,
    }
  }

  // Boundaries stay attached to their nominal month: a weekend shift can pull
  // one into the previous month (2 August -> 31 July), so pick the latest
  // boundary that has already started rather than assuming this month's.
  const thisMonth = year * 12 + month
  const startsAt = (months: number) =>
    anchorStartAt(months, anchor, shiftWeekends)

  let periodMonth = thisMonth
  if (now.getTime() < startsAt(thisMonth).getTime()) {
    periodMonth -= 1
  } else if (now.getTime() >= startsAt(thisMonth + 1).getTime()) {
    periodMonth += 1
  }

  return {
    start: startsAt(periodMonth),
    end: new Date(startsAt(periodMonth + 1).getTime() - MS_PER_DAY),
    anchored: true,
  }
}

export type UpcomingIncome = {
  name: string
  amountMinor: number
  currency: string
  date: Date
}

export type CategorySubscriptionSpend = {
  id: string
  name: string
  amountMinor: number
}

export type CategorySpend = {
  id: string | null
  name: string
  color: string | null
  amountMinor: number
  subscriptions: CategorySubscriptionSpend[]
}

export type BudgetStatus = {
  currency: string
  locale: string
  period: BudgetPeriod
  budgetMinor: number | null
  /** The manual ceiling from settings, independent of income. */
  ceilingMinor: number | null
  /** Expected income in the period across active sources; null without any. */
  incomeMinor: number | null
  /** The soonest pay ahead across active sources; null without any. */
  nextIncome: UpcomingIncome | null
  /** Charges dated inside the period, including ones already taken. */
  dueMinor: number
  /** The same charges grouped by category, largest first. */
  byCategory: CategorySpend[]
  remainingMinor: number | null
  overBudget: boolean
  unconvertibleCurrencies: string[]
}

export async function getBudgetStatus(
  db: Database,
  userId: string,
  options: { now?: Date; fetchFn?: Fetcher } = {},
): Promise<BudgetStatus> {
  const now = options.now ?? new Date()
  const settings = await getSettings(db, userId)
  const period = getBudgetPeriod(
    now,
    settings.payAnchorDay,
    settings.payAnchorShiftWeekends,
  )

  const [page, sources, categoryPage] = await Promise.all([
    listSubscriptions(
      db,
      userId,
      { limit: 100, offset: 0, sort: 'next-payment', order: 'asc' },
      now,
    ),
    listIncomeSources(db, userId),
    listCategories(db, userId, {
      limit: 1000,
      offset: 0,
      includeArchived: true,
    }),
  ])

  const { rows: rateRows } = await ensureRates(db, {
    now,
    fetchFn: options.fetchFn,
  })
  const rates = ratesMap(rateRows)
  const categoryById = new Map(categoryPage.items.map((row) => [row.id, row]))

  let dueMinor = 0
  const unconvertible = new Set<string>()
  const categorySpend = new Map<string, CategorySpend>()

  for (const subscription of page.items) {
    const cycle = {
      count: subscription.cycleCount,
      unit: subscription.cycleUnit as CycleUnit,
    }

    // nextPayment is the next occurrence, not the first one: reach back to
    // the period start so charges already taken this period still count.
    const occurrences = occurrencesBetween(
      subscription.nextPayment,
      cycle,
      period.start,
      period.end,
      period.start,
    ).filter(
      (date) =>
        !subscription.cancelledAt ||
        date.getTime() <= subscription.cancelledAt.getTime(),
    ).length

    if (occurrences === 0) {
      continue
    }

    const rate = crossRate(subscription.currency, settings.currency, rates)
    if (rate === null) {
      unconvertible.add(subscription.currency)
      continue
    }

    const amountMinor =
      occurrences *
      convertMinorUnits(
        subscription.viewerShareMinor,
        rate,
        subscription.currency,
        settings.currency,
      )
    dueMinor += amountMinor
    if (amountMinor === 0) {
      continue
    }

    const category = subscription.categoryId
      ? categoryById.get(subscription.categoryId)
      : undefined
    const key = category?.id ?? 'uncategorized'
    const row = categorySpend.get(key) ?? {
      id: category?.id ?? null,
      name: category?.name ?? 'Uncategorized',
      color: category?.color ?? null,
      amountMinor: 0,
      subscriptions: [],
    }
    row.amountMinor += amountMinor

    const subscriptionShare = row.subscriptions.find(
      (item) => item.id === subscription.id,
    )
    if (subscriptionShare) {
      subscriptionShare.amountMinor += amountMinor
    } else {
      row.subscriptions.push({
        id: subscription.id,
        name: subscription.name,
        amountMinor,
      })
    }
    categorySpend.set(key, row)
  }

  for (const row of categorySpend.values()) {
    row.subscriptions.sort(
      (a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name),
    )
  }

  let incomeMinor: number | null = null
  let nextIncome: UpcomingIncome | null = null

  if (sources.length > 0) {
    incomeMinor = 0
    for (const arrival of periodArrivals(sources, period.start, period.end)) {
      const currency = arrival.source.currency
      const rate = crossRate(currency, settings.currency, rates)
      if (rate === null) {
        unconvertible.add(currency)
        continue
      }
      incomeMinor += convertMinorUnits(
        arrival.source.amountMinor,
        rate,
        currency,
        settings.currency,
      )
    }

    for (const source of sources) {
      const date = nextArrival(source, now)
      if (nextIncome === null || date.getTime() < nextIncome.date.getTime()) {
        nextIncome = {
          name: source.name,
          amountMinor: source.amountMinor,
          currency: source.currency,
          date,
        }
      }
    }
  }

  const ceilingMinor = settings.budgetAmountMinor ?? null

  /**
   * Income drives the period's budget when any is expected; the manual
   * ceiling then clamps it down. With no income in sight, the ceiling (if
   * any) is all the budget there is — and without either, next to nothing.
   */
  const budgetMinor =
    incomeMinor !== null && incomeMinor > 0
      ? ceilingMinor === null
        ? incomeMinor
        : Math.min(ceilingMinor, incomeMinor)
      : ceilingMinor

  return {
    currency: settings.currency,
    locale: settings.locale,
    period,
    budgetMinor,
    ceilingMinor,
    incomeMinor,
    nextIncome,
    dueMinor,
    byCategory: [...categorySpend.values()].sort(
      (a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name),
    ),
    remainingMinor: budgetMinor === null ? null : budgetMinor - dueMinor,
    overBudget: budgetMinor !== null && dueMinor > budgetMinor,
    unconvertibleCurrencies: [...unconvertible].sort(),
  }
}
