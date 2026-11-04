import { describe, expect, it } from 'vitest'
import { getBudgetPeriod, getBudgetStatus } from '@/server/services/budget'
import { createCategory } from '@/server/services/categories'
import { createIncomeSource } from '@/server/services/income-sources'
import { createMember } from '@/server/services/sharing'
import { createSubscription } from '@/server/services/subscriptions'
import { updateSettings } from '@/server/services/settings'
import { createTestDb, insertTestUser } from '@/test/db'

const payload = {
  base: 'EUR',
  date: '2026-10-14',
  rates: { DKK: 7.46 },
}

const now = new Date('2026-10-14T12:00:00.000Z')

function fakeFetch(payloadValue: unknown) {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    json: async () => payloadValue,
  })
  return { fetchFn }
}

const options = { now, fetchFn: fakeFetch(payload).fetchFn }

describe('budget: period math', () => {
  it('uses calendar months when no anchor is set', () => {
    const period = getBudgetPeriod(now, null)

    expect(period.start).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-10-31T00:00:00.000Z'))
    expect(period.anchored).toBe(false)
  })

  it('treats a day-1 anchor as calendar months too', () => {
    expect(getBudgetPeriod(now, 1).anchored).toBe(false)
  })

  it('anchors the period to the pay day', () => {
    const period = getBudgetPeriod(now, 25)

    expect(period.start).toEqual(new Date('2026-09-25T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-10-24T00:00:00.000Z'))
  })

  it('starts a new anchored period on the anchor day', () => {
    const period = getBudgetPeriod(new Date('2026-10-25T08:00:00.000Z'), 25)

    expect(period.start).toEqual(new Date('2026-10-25T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-11-24T00:00:00.000Z'))
  })

  it('clamps anchor days to short months', () => {
    const midFebruary = getBudgetPeriod(
      new Date('2026-02-15T12:00:00.000Z'),
      31,
    )
    expect(midFebruary.start).toEqual(new Date('2026-01-31T00:00:00.000Z'))
    expect(midFebruary.end).toEqual(new Date('2026-02-27T00:00:00.000Z'))

    const paydayFebruary = getBudgetPeriod(
      new Date('2026-02-28T12:00:00.000Z'),
      31,
    )
    expect(paydayFebruary.start).toEqual(new Date('2026-02-28T00:00:00.000Z'))
    expect(paydayFebruary.end).toEqual(new Date('2026-03-30T00:00:00.000Z'))
  })

  it('leaves weekend anchors alone unless shifting is on', () => {
    const period = getBudgetPeriod(new Date('2026-10-26T08:00:00.000Z'), 25)

    expect(period.start).toEqual(new Date('2026-10-25T00:00:00.000Z'))
  })

  it('moves a Sunday anchor back to Friday', () => {
    const period = getBudgetPeriod(
      new Date('2026-10-26T08:00:00.000Z'),
      25,
      true,
    )

    expect(period.start).toEqual(new Date('2026-10-23T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-11-24T00:00:00.000Z'))
  })

  it('moves a Saturday anchor back to Friday', () => {
    const period = getBudgetPeriod(
      new Date('2026-07-25T08:00:00.000Z'),
      25,
      true,
    )

    expect(period.start).toEqual(new Date('2026-07-24T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-08-24T00:00:00.000Z'))
  })

  it('shifts a clamped short-month anchor off the weekend', () => {
    // Day 31 clamps to 28 February 2026, a Saturday.
    const period = getBudgetPeriod(
      new Date('2026-02-27T08:00:00.000Z'),
      31,
      true,
    )

    expect(period.start).toEqual(new Date('2026-02-27T00:00:00.000Z'))
    expect(period.end).toEqual(new Date('2026-03-30T00:00:00.000Z'))
  })

  it('keeps a weekday anchor in place', () => {
    const period = getBudgetPeriod(
      new Date('2026-09-25T08:00:00.000Z'),
      25,
      true,
    )

    expect(period.start).toEqual(new Date('2026-09-25T00:00:00.000Z'))
  })

  it('starts the weekend-earlier period before the weekend', () => {
    // 2 August 2026 is a Sunday, so August opens on Friday 31 July.
    const thursday = getBudgetPeriod(
      new Date('2026-07-30T08:00:00.000Z'),
      2,
      true,
    )
    const friday = getBudgetPeriod(
      new Date('2026-07-31T08:00:00.000Z'),
      2,
      true,
    )

    expect(thursday.start).toEqual(new Date('2026-07-02T00:00:00.000Z'))
    expect(thursday.end).toEqual(new Date('2026-07-30T00:00:00.000Z'))
    expect(friday.start).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    expect(friday.end).toEqual(new Date('2026-09-01T00:00:00.000Z'))
  })
})

describe('budget: status', () => {
  it('sums the charges due inside the anchored period', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', {
      budgetAmountMinor: 20000,
      payAnchorDay: 25,
    })

    await createSubscription(
      db,
      'u1',
      {
        name: 'Inside Period',
        price: 9900,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-01T00:00:00.000Z'),
      },
      now,
    )
    await createSubscription(
      db,
      'u1',
      {
        name: 'After Period',
        price: 19900,
        currency: 'DKK',
        cycleUnit: 'years',
        cycleCount: 1,
        nextPayment: new Date('2027-10-28T00:00:00.000Z'),
      },
      now,
    )
    await createSubscription(
      db,
      'u1',
      {
        name: 'Far Away',
        price: 120000,
        currency: 'DKK',
        cycleUnit: 'years',
        cycleCount: 1,
        nextPayment: new Date('2027-06-15T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.period.start).toEqual(new Date('2026-09-25T00:00:00.000Z'))
    expect(status.dueMinor).toBe(9900)
    expect(status.budgetMinor).toBe(20000)
    expect(status.remainingMinor).toBe(10100)
    expect(status.overBudget).toBe(false)
  })

  it('counts charges that were already taken this period', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', { budgetAmountMinor: 200000 })

    await createSubscription(
      db,
      'u1',
      {
        name: 'Monthly, rolled to next month',
        price: 9900,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-11-01T00:00:00.000Z'),
      },
      now,
    )
    await createSubscription(
      db,
      'u1',
      {
        name: 'Quarterly, rolled to next quarter',
        price: 5000,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 3,
        nextPayment: new Date('2027-01-05T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.period.start).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(status.dueMinor).toBe(9900 + 5000)
  })

  it('breaks the period total down by category', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    const travel = await createCategory(db, 'u1', { name: 'Travel' })
    const music = await createCategory(db, 'u1', { name: 'Music' })
    if (!travel || !music) throw new Error('could not create categories')

    await createSubscription(
      db,
      'u1',
      {
        name: 'Train',
        price: 1000,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-02T00:00:00.000Z'),
        categoryId: travel.id,
      },
      now,
    )
    await createSubscription(
      db,
      'u1',
      {
        name: 'Gig',
        price: 500,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-05T00:00:00.000Z'),
        categoryId: music.id,
      },
      now,
    )
    await createSubscription(
      db,
      'u1',
      {
        name: 'Misc',
        price: 250,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-10T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.dueMinor).toBe(1750)
    expect(status.byCategory).toMatchObject([
      {
        id: travel.id,
        name: 'Travel',
        color: null,
        amountMinor: 1000,
        subscriptions: [{ name: 'Train', amountMinor: 1000 }],
      },
      {
        id: music.id,
        name: 'Music',
        color: null,
        amountMinor: 500,
        subscriptions: [{ name: 'Gig', amountMinor: 500 }],
      },
      {
        id: null,
        name: 'Uncategorized',
        color: null,
        amountMinor: 250,
        subscriptions: [{ name: 'Misc', amountMinor: 250 }],
      },
    ])
  })

  it('counts only the owner share of a split subscription', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    const subscription = await createSubscription(
      db,
      'u1',
      {
        name: 'Split',
        price: 10000,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-01T00:00:00.000Z'),
      },
      now,
    )
    if (!subscription) throw new Error('could not create subscription')

    const member = await createMember(db, 'u1', subscription.id, {
      displayName: 'Friend',
      shareMinor: 4000,
    })
    if (typeof member === 'string') throw new Error(member)

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.dueMinor).toBe(6000)
    expect(status.byCategory).toMatchObject([
      {
        id: null,
        name: 'Uncategorized',
        color: null,
        amountMinor: 6000,
        subscriptions: [{ name: 'Split', amountMinor: 6000 }],
      },
    ])
  })

  it('flags over-budget periods and converts foreign occurrences', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', { budgetAmountMinor: 5000 })

    await createSubscription(
      db,
      'u1',
      {
        name: 'EUR Sub',
        price: 1000,
        currency: 'EUR',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-05T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.dueMinor).toBe(7460)
    expect(status.overBudget).toBe(true)
    expect(status.remainingMinor).toBe(5000 - 7460)
  })

  it('reports the period due even without a budget', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    await createSubscription(
      db,
      'u1',
      {
        name: 'Sub',
        price: 9900,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-15T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.period.anchored).toBe(false)
    expect(status.budgetMinor).toBeNull()
    expect(status.remainingMinor).toBeNull()
    expect(status.dueMinor).toBe(9900)
  })
})

describe('budget: end dates', () => {
  it('ignores charges that would land after the subscription ends', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    await createSubscription(
      db,
      'u1',
      {
        name: 'Ends Before Charge',
        price: 9900,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-20T00:00:00.000Z'),
        cancelledAt: new Date('2026-10-19T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)
    expect(status.dueMinor).toBe(0)
  })
})

describe('budget: income sources', () => {
  it('drives the budget from expected income when no ceiling is set', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', {
      payAnchorDay: 25,
      budgetAmountMinor: null,
    })

    await createIncomeSource(db, 'u1', {
      name: 'Full-time job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2026-09-25T00:00:00.000Z'),
    })
    await createSubscription(
      db,
      'u1',
      {
        name: 'Rent-ish',
        price: 900000,
        currency: 'DKK',
        cycleUnit: 'months',
        cycleCount: 1,
        nextPayment: new Date('2026-10-01T00:00:00.000Z'),
      },
      now,
    )

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.period.start).toEqual(new Date('2026-09-25T00:00:00.000Z'))
    expect(status.incomeMinor).toBe(2450000)
    expect(status.budgetMinor).toBe(2450000)
    expect(status.remainingMinor).toBe(2450000 - 900000)
    expect(status.overBudget).toBe(false)
  })

  it('lets the manual ceiling clamp income down', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', {
      payAnchorDay: 25,
      budgetAmountMinor: 100000,
    })

    await createIncomeSource(db, 'u1', {
      name: 'Full-time job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2026-09-25T00:00:00.000Z'),
    })

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.incomeMinor).toBe(2450000)
    expect(status.ceilingMinor).toBe(100000)
    expect(status.budgetMinor).toBe(100000)
    expect(status.remainingMinor).toBe(100000)
  })

  it('sums several sources and converts foreign currencies', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', { payAnchorDay: 25 })

    await createIncomeSource(db, 'u1', {
      name: 'Full-time job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2026-09-25T00:00:00.000Z'),
    })
    await createIncomeSource(db, 'u1', {
      name: 'Part-time job',
      amountMinor: 2000,
      currency: 'EUR',
      cycleUnit: 'weeks',
      cycleCount: 2,
      nextArrival: new Date('2026-09-18T00:00:00.000Z'),
    })

    const status = await getBudgetStatus(db, 'u1', options)

    // Fortnightly EUR: two arrivals (2 + 16 Oct) convert at 7.46.
    expect(status.incomeMinor).toBe(2450000 + 2 * 2000 * 7.46)
  })

  it('falls back to the ceiling when the source has not paid yet', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', {
      payAnchorDay: 25,
      budgetAmountMinor: 50000,
    })

    await createIncomeSource(db, 'u1', {
      name: 'New job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2026-12-01T00:00:00.000Z'),
    })

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.incomeMinor).toBe(0)
    expect(status.budgetMinor).toBe(50000)
    expect(status.nextIncome).toEqual({
      name: 'New job',
      amountMinor: 2450000,
      currency: 'DKK',
      date: new Date('2026-12-01T00:00:00.000Z'),
    })
  })

  it('counts the pay the start date reaches back to', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await updateSettings(db, 'u1', { payAnchorDay: 25 })

    await createIncomeSource(db, 'u1', {
      name: 'Full-time job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2026-11-01T00:00:00.000Z'),
      startDate: new Date('2026-10-01T00:00:00.000Z'),
    })

    const status = await getBudgetStatus(db, 'u1', options)

    // The period (25 Sep – 24 Oct) catches the salary that landed on 1 Oct.
    expect(status.incomeMinor).toBe(2450000)
    expect(status.budgetMinor).toBe(2450000)
    expect(status.remainingMinor).toBe(2450000)
  })

  it('reports no budget when sources expect nothing and no ceiling is set', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    await createIncomeSource(db, 'u1', {
      name: 'Future job',
      amountMinor: 2450000,
      currency: 'DKK',
      cycleUnit: 'months',
      cycleCount: 1,
      nextArrival: new Date('2027-01-01T00:00:00.000Z'),
    })

    const status = await getBudgetStatus(db, 'u1', options)

    expect(status.incomeMinor).toBe(0)
    expect(status.budgetMinor).toBeNull()
    expect(status.remainingMinor).toBeNull()
    expect(status.nextIncome?.date).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    )
  })
})
