import * as z from 'zod'
import type { Database } from '../lib/db'
import { isExternalLogo } from '../lib/logo-source'
import { socialProviderIds } from '../lib/social-providers'
import { logoExists } from './logos'
import { channelTypes } from './services/channels'
import { getPaymentMethod } from './services/payment-methods'
import { cycleUnits } from './services/recurrence'
import { themes, weekStarts } from './services/settings'

export const urlField = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), {
    message: 'URL must start with http:// or https://',
  })
  .transform((value) => (value === '' ? null : value))
  .nullish()

export const logoField = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === '' || isExternalLogo(value) || /^[A-Za-z0-9._-]+$/.test(value),
    { message: 'Logo must be an uploaded file name or an http(s) URL' },
  )
  .transform((value) => (value === '' ? null : value))
  .nullish()

export const subscriptionBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().int().min(0),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  cycleUnit: z.enum(cycleUnits),
  cycleCount: z.number().int().min(1).max(365),
  categoryId: z.string().nullish(),
  paymentMethodId: z.string().nullish(),
  url: urlField,
  nextPayment: z.coerce.date(),
  notes: z.string().max(2000).nullish(),
  remindDaysBefore: z.number().int().min(0).max(60).nullish(),
  remindEnabled: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
  cancelledAt: z.coerce.date().nullish(),
  logo: logoField,
})

export { socialProviderIds }
export type SocialProviderName = string

export const socialExtraSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
)

export const socialProviderUpdateSchema = z.object({
  provider: z.enum(socialProviderIds),
  clientId: z.string().trim().min(1).max(500),
  clientSecret: z.string().trim().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
  extra: socialExtraSchema.optional(),
})

export const channelBodySchema = z.object({
  type: z.enum(channelTypes),
  name: z.string().trim().min(1).max(100),
  config: z.unknown(),
  enabled: z.boolean().optional(),
})

export const channelPatchSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(100).optional(),
  config: z.unknown().optional(),
  enabled: z.boolean().optional(),
})

export const categoryBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().max(20).nullish(),
})

export const categoryPatchSchema = categoryBodySchema
  .partial()
  .extend({ id: z.string() })

export const paymentMethodBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  icon: z.string().max(200).nullish(),
})

export const paymentMethodPatchSchema = paymentMethodBodySchema
  .partial()
  .extend({ id: z.string() })

export const incomeSourceBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  amountMinor: z.number().int().min(0),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  cycleUnit: z.enum(cycleUnits),
  cycleCount: z.number().int().min(1).max(365),
  nextArrival: z.coerce.date(),
  startDate: z.coerce.date().nullish(),
})

export const incomeSourcePatchSchema = incomeSourceBodySchema
  .partial()
  .extend({ id: z.string() })

export const memberBodySchema = z.object({
  subscriptionId: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().max(320).nullish(),
  shareMinor: z.number().int().min(0),
})

export const memberPatchSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().max(320).nullish(),
  shareMinor: z.number().int().min(0).optional(),
})

export const memberReminderSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
})

export const reorderIdsSchema = z.object({ ids: z.array(z.string()).max(500) })

export const localeField = z.string().min(2).max(20)

export const onboardingBodySchema = z.object({
  locale: localeField,
  seed: z.boolean().default(true),
})

export const settingsPatchSchema = z.object({
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  locale: localeField.optional(),
  weekStart: z.enum(weekStarts).optional(),
  theme: z.enum(themes).optional(),
  budgetAmountMinor: z.number().int().min(0).nullish(),
  payAnchorDay: z.number().int().min(1).max(31).nullish(),
  payAnchorShiftWeekends: z.boolean().optional(),
  remindDaysBefore: z.number().int().min(0).max(60).nullish(),
  remindersEnabled: z.boolean().optional(),
})

export type ReferenceError = 'PAYMENT_METHOD_NOT_FOUND' | 'LOGO_NOT_FOUND'

/**
 * Shared by the HTTP plugin endpoints and the app's server functions so the
 * same references are checked at every entry point.
 */
export async function checkSubscriptionReferences(
  db: Database,
  userId: string,
  input: { paymentMethodId?: string | null; logo?: string | null },
): Promise<ReferenceError | null> {
  if (input.paymentMethodId) {
    const method = await getPaymentMethod(db, userId, input.paymentMethodId)
    if (!method) {
      return 'PAYMENT_METHOD_NOT_FOUND'
    }
  }
  if (input.logo && !isExternalLogo(input.logo) && !logoExists(input.logo)) {
    return 'LOGO_NOT_FOUND'
  }
  return null
}
