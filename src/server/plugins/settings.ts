import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import { db } from '../../lib/db'
import * as settings from '../services/settings'
import { settingsPatchSchema } from '../validation'

export const settingsPlugin = () =>
  ({
    id: 'settings',
    schema: {
      userSetting: {
        fields: {
          currency: { type: 'string', required: false },
          locale: { type: 'string', required: false },
          weekStart: { type: 'string', required: false },
          theme: { type: 'string', required: false },
          budgetAmountMinor: { type: 'number', required: false },
          payAnchorDay: { type: 'number', required: false },
          payAnchorShiftWeekends: { type: 'boolean', required: false },
          remindDaysBefore: { type: 'number', required: false },
          remindersEnabled: { type: 'boolean', required: false },
          icalToken: { type: 'string', required: false },
          userId: {
            type: 'string',
            required: true,
            unique: true,
            references: { model: 'user', field: 'id', onDelete: 'cascade' },
          },
          createdAt: { type: 'date', required: false },
        },
        indexes: [{ fields: ['icalToken'] }],
      },
    },
    endpoints: {
      getSettings: createAuthEndpoint(
        '/settings/get',
        {
          method: 'GET',
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id
          return ctx.json(await settings.getSettings(db, userId))
        },
      ),
      updateSettings: createAuthEndpoint(
        '/settings/update',
        {
          method: 'POST',
          body: settingsPatchSchema,
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const userId = ctx.context.session.user.id
          return ctx.json(await settings.updateSettings(db, userId, ctx.body))
        },
      ),
    },
  }) satisfies BetterAuthPlugin
