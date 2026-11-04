import { describe, expect, it } from 'vitest'
import { seedDefaults } from '@/server/services/defaults'
import {
  defaultSettings,
  getOnboardedAt,
  getSettings,
  updateSettings,
} from '@/server/services/settings'
import { createTestDb, insertTestUser } from '@/test/db'

describe('settings service', () => {
  it('returns defaults when the user has no settings row', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    expect(await getSettings(db, 'u1')).toEqual(defaultSettings)
  })

  it('reports onboarding as unset until the stamp is written', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    expect(await getOnboardedAt(db, 'u1')).toBeNull()

    await seedDefaults(db, 'u1', 'da', { seed: false })

    expect(await getOnboardedAt(db, 'u1')).toBeInstanceOf(Date)
  })

  it('creates a settings row on first update and patches it after', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    const created = await updateSettings(db, 'u1', {
      currency: 'EUR',
      theme: 'dark',
    })
    expect(created).toEqual({
      currency: 'EUR',
      locale: defaultSettings.locale,
      weekStart: defaultSettings.weekStart,
      theme: 'dark',
      budgetAmountMinor: null,
      payAnchorDay: null,
      payAnchorShiftWeekends: false,
      remindDaysBefore: defaultSettings.remindDaysBefore,
      remindersEnabled: defaultSettings.remindersEnabled,
      icalToken: null,
    })

    const patched = await updateSettings(db, 'u1', { locale: 'da' })
    expect(patched.locale).toBe('da')
    expect(patched.currency).toBe('EUR')
    expect(patched.theme).toBe('dark')
  })

  it('remembers whether weekend paydays move', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    const on = await updateSettings(db, 'u1', {
      payAnchorShiftWeekends: true,
    })
    expect(on.payAnchorShiftWeekends).toBe(true)
    expect((await getSettings(db, 'u1')).payAnchorShiftWeekends).toBe(true)

    const off = await updateSettings(db, 'u1', {
      payAnchorShiftWeekends: false,
    })
    expect(off.payAnchorShiftWeekends).toBe(false)
  })

  it('switches reminders off and back on', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')

    const off = await updateSettings(db, 'u1', { remindersEnabled: false })
    expect(off.remindersEnabled).toBe(false)
    expect((await getSettings(db, 'u1')).remindersEnabled).toBe(false)

    const on = await updateSettings(db, 'u1', { remindersEnabled: true })
    expect(on.remindersEnabled).toBe(true)
  })

  it('keeps settings isolated per user', async () => {
    const { db } = createTestDb()
    await insertTestUser(db, 'u1')
    await insertTestUser(db, 'u2')

    await updateSettings(db, 'u1', { currency: 'USD' })

    expect((await getSettings(db, 'u2')).currency).toBe(
      defaultSettings.currency,
    )
    expect((await getSettings(db, 'u1')).currency).toBe('USD')
  })
})
