import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { APP_VERSION } from '../../lib/version'
import { db } from '../../lib/db'
import * as categories from '../services/categories'
import * as incomeSources from '../services/income-sources'
import * as subscriptions from '../services/subscriptions'

function userIdFrom(authInfo?: AuthInfo): string {
  const userId = authInfo?.extra?.userId
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Unauthorized: missing access token claims')
  }
  return userId
}

function json(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

export function createFristMcpServer(authInfo?: AuthInfo) {
  const server = new McpServer({ name: 'frist', version: APP_VERSION })

  server.registerTool(
    'list_subscriptions',
    {
      description:
        'List tracked subscriptions sorted by next payment date, with optional category filter and pagination.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        categoryId: z.string().optional(),
      }),
    },
    async (args) => {
      const userId = userIdFrom(authInfo)
      return json(
        await subscriptions.listSubscriptions(db, userId, {
          limit: args.limit,
          offset: args.offset,
          categoryId: args.categoryId,
          sort: 'next-payment',
          order: 'asc',
        }),
      )
    },
  )

  server.registerTool(
    'get_subscription',
    {
      description: 'Get a single subscription by id.',
      inputSchema: z.object({ id: z.string() }),
    },
    async (args) => {
      const userId = userIdFrom(authInfo)
      const subscription = await subscriptions.getSubscription(
        db,
        userId,
        args.id,
      )
      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND')
      }
      return json(subscription)
    },
  )

  server.registerTool(
    'list_categories',
    {
      description: 'List active categories in display order.',
      inputSchema: z.object({}),
    },
    async () => {
      const userId = userIdFrom(authInfo)
      return json(
        await categories.listCategories(db, userId, { limit: 100, offset: 0 }),
      )
    },
  )

  server.registerTool(
    'list_income_sources',
    {
      description:
        'List income sources such as salaries and side jobs, with their amount, pay cadence and rolled-forward next payday. Use includeArchived to see paused sources.',
      inputSchema: z.object({
        includeArchived: z.boolean().default(false),
      }),
    },
    async (args) => {
      const userId = userIdFrom(authInfo)
      const now = new Date()
      const items = await incomeSources.listIncomeSources(db, userId, args)
      return json(
        items.map((source) => ({
          ...source,
          nextPayday: incomeSources.nextArrival(source, now),
        })),
      )
    },
  )

  server.registerTool(
    'upcoming_payments',
    {
      description:
        'List payments due within the next N days (default 30). Due dates are rolled forward past today.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
    },
    async (args) => {
      const userId = userIdFrom(authInfo)
      const horizon = new Date(Date.now() + args.days * 24 * 60 * 60 * 1000)
      const { items } = await subscriptions.listSubscriptions(db, userId, {
        limit: 100,
        offset: 0,
        sort: 'next-payment',
        order: 'asc',
      })
      const upcoming = items.filter((item) => item.nextDue <= horizon)
      return json({ days: args.days, count: upcoming.length, items: upcoming })
    },
  )

  return server
}
