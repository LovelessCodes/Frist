import { relations, sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text('role'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp_ms' }),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(
    false,
  ),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const apikey = sqliteTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').default('default').notNull(),
    name: text('name'),
    start: text('start'),
    referenceId: text('reference_id').notNull(),
    prefix: text('prefix'),
    key: text('key').notNull(),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    lastRefillAt: integer('last_refill_at', { mode: 'timestamp_ms' }),
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    rateLimitEnabled: integer('rate_limit_enabled', {
      mode: 'boolean',
    }).default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window').default(3600000),
    rateLimitMax: integer('rate_limit_max').default(600),
    requestCount: integer('request_count').default(0),
    remaining: integer('remaining'),
    lastRequest: integer('last_request', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    permissions: text('permissions'),
    metadata: text('metadata'),
  },
  (table) => [
    index('apikey_configId_idx').on(table.configId),
    index('apikey_referenceId_idx').on(table.referenceId),
    index('apikey_key_idx').on(table.key),
  ],
)

export const jwks = sqliteTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  alg: text('alg'),
  crv: text('crv'),
})

export const passkey = sqliteTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    transports: text('transports'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    aaguid: text('aaguid'),
  },
  (table) => [
    index('passkey_userId_idx').on(table.userId),
    index('passkey_credentialID_idx').on(table.credentialID),
  ],
)

export const twoFactor = sqliteTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: integer('verified', { mode: 'boolean' }).default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('twoFactor_secret_idx').on(table.secret),
    index('twoFactor_userId_idx').on(table.userId),
  ],
)

export const category = sqliteTable(
  'category',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color'),
    position: integer('position').notNull().default(0),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('category_userId_idx').on(table.userId)],
)

export const channel = sqliteTable(
  'channel',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    config: text('config').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('channel_userId_idx').on(table.userId)],
)

export const notificationDelivery = sqliteTable(
  'notification_delivery',
  {
    id: text('id').primaryKey(),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull(),
    lastError: text('last_error'),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    notificationId: text('notification_id')
      .notNull()
      .references(() => notification.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channel.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('notificationDelivery_notificationId_channelId_uidx').on(
      table.notificationId,
      table.channelId,
    ),
    index('notificationDelivery_userId_idx').on(table.userId),
  ],
)

export const exchangeRate = sqliteTable('exchange_rate', {
  id: text('id').primaryKey(),
  quote: text('quote').notNull().unique(),
  rate: integer('rate').notNull(),
  rateDate: integer('rate_date', { mode: 'timestamp_ms' }).notNull(),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
})

export const costSnapshot = sqliteTable(
  'cost_snapshot',
  {
    id: text('id').primaryKey(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    totalMinor: integer('total_minor').notNull(),
    currency: text('currency').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('costSnapshot_userId_year_month_uidx').on(
      table.userId,
      table.year,
      table.month,
    ),
    index('costSnapshot_userId_idx').on(table.userId),
  ],
)

export const incomeSource = sqliteTable(
  'income_source',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    cycleUnit: text('cycle_unit').notNull(),
    cycleCount: integer('cycle_count').notNull(),
    nextArrival: integer('next_arrival', { mode: 'timestamp_ms' }).notNull(),
    startDate: integer('start_date', { mode: 'timestamp_ms' }),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('incomeSource_userId_idx').on(table.userId)],
)

export const notification = sqliteTable(
  'notification',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    dueDate: integer('due_date', { mode: 'timestamp_ms' }).notNull(),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscription.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('notification_userId_subscriptionId_type_dueDate_uidx').on(
      table.userId,
      table.subscriptionId,
      table.type,
      table.dueDate,
    ),
    index('notification_userId_idx').on(table.userId),
  ],
)

export const paymentMethod = sqliteTable(
  'payment_method',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),
    position: integer('position').notNull().default(0),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('paymentMethod_userId_idx').on(table.userId)],
)

export const userSetting = sqliteTable(
  'user_setting',
  {
    id: text('id').primaryKey(),
    currency: text('currency'),
    locale: text('locale'),
    weekStart: text('week_start'),
    theme: text('theme'),
    budgetAmountMinor: integer('budget_amount_minor'),
    payAnchorDay: integer('pay_anchor_day'),
    payAnchorShiftWeekends: integer('pay_anchor_shift_weekends', {
      mode: 'boolean',
    }),
    remindDaysBefore: integer('remind_days_before'),
    remindersEnabled: integer('reminders_enabled', { mode: 'boolean' }),
    icalToken: text('ical_token'),
    onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('userSetting_icalToken_idx').on(table.icalToken)],
)

export const socialProvider = sqliteTable('social_provider', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().unique(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  extra: text('extra'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const subscription = sqliteTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    currency: text('currency').notNull(),
    cycleUnit: text('cycle_unit').notNull(),
    cycleCount: integer('cycle_count').notNull(),
    categoryId: text('category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
    paymentMethodId: text('payment_method_id').references(
      () => paymentMethod.id,
      { onDelete: 'set null' },
    ),
    url: text('url'),
    nextPayment: integer('next_payment', { mode: 'timestamp_ms' }).notNull(),
    notes: text('notes'),
    remindDaysBefore: integer('remind_days_before'),
    remindEnabled: integer('remind_enabled', { mode: 'boolean' }).default(true),
    autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    logo: text('logo'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('subscription_userId_idx').on(table.userId),
    index('subscription_categoryId_idx').on(table.categoryId),
    index('subscription_paymentMethodId_idx').on(table.paymentMethodId),
  ],
)

/**
 * A split of a subscription. The owner keeps the canonical row; every other
 * person is a member row with a share in the subscription's currency.
 * `user_id` is null until the person accepts an invite (or forever, for a
 * name-only placeholder).
 */
export const subscriptionMember = sqliteTable(
  'subscription_member',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscription.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    email: text('email'),
    shareMinor: integer('share_minor').notNull(),
    status: text('status').notNull(),
    /** SHA-256 of the one-time invite token; null unless `status = invited`. */
    inviteHash: text('invite_hash'),
    inviteExpiresAt: integer('invite_expires_at', { mode: 'timestamp_ms' }),
    categoryId: text('category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
    remindEnabled: integer('remind_enabled', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('subscriptionMember_subscriptionId_idx').on(table.subscriptionId),
    index('subscriptionMember_userId_idx').on(table.userId),
    uniqueIndex('subscriptionMember_subscriptionId_userId_uidx')
      .on(table.subscriptionId, table.userId)
      .where(sql`${table.userId} is not null`),
  ],
)

export const oauthClient = sqliteTable(
  'oauth_client',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    clientDiscoveryId: text('client_discovery_id'),
    disabled: integer('disabled', { mode: 'boolean' }).default(false),
    skipConsent: integer('skip_consent', { mode: 'boolean' }),
    enableEndSession: integer('enable_end_session', { mode: 'boolean' }),
    subjectType: text('subject_type'),
    scopes: text('scopes', { mode: 'json' }),
    clientCredentialsScopes: text('client_credentials_scopes', {
      mode: 'json',
    }).default([]),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    name: text('name'),
    uri: text('uri'),
    icon: text('icon'),
    contacts: text('contacts', { mode: 'json' }),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: text('software_id'),
    softwareVersion: text('software_version'),
    softwareStatement: text('software_statement'),
    redirectUris: text('redirect_uris', { mode: 'json' }).notNull(),
    postLogoutRedirectUris: text('post_logout_redirect_uris', { mode: 'json' }),
    backchannelLogoutUri: text('backchannel_logout_uri'),
    backchannelLogoutSessionRequired: integer(
      'backchannel_logout_session_required',
      { mode: 'boolean' },
    ),
    tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
    applicationType: text('application_type'),
    jwks: text('jwks'),
    jwksUri: text('jwks_uri'),
    grantTypes: text('grant_types', { mode: 'json' }),
    responseTypes: text('response_types', { mode: 'json' }),
    requirePKCE: integer('require_pkce', { mode: 'boolean' }),
    dpopBoundAccessTokens: integer('dpop_bound_access_tokens', {
      mode: 'boolean',
    }).default(false),
    referenceId: text('reference_id'),
    metadata: text('metadata', { mode: 'json' }),
  },
  (table) => [index('oauthClient_userId_idx').on(table.userId)],
)

export const oauthResource = sqliteTable('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes', { mode: 'json' }),
  customClaims: text('custom_claims', { mode: 'json' }),
  dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', {
    mode: 'boolean',
  }).default(false),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  policyVersion: integer('policy_version').default(1),
  metadata: text('metadata', { mode: 'json' }),
})

export const oauthClientResource = sqliteTable(
  'oauth_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: 'cascade' }),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('oauthClientResource_clientId_resourceId_uidx').on(
      table.clientId,
      table.resourceId,
    ),
    index('oauthClientResource_clientId_idx').on(table.clientId),
    index('oauthClientResource_resourceId_idx').on(table.resourceId),
  ],
)

export const oauthRefreshToken = sqliteTable(
  'oauth_refresh_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => session.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources', { mode: 'json' }),
    requestedUserInfoClaims: text('requested_user_info_claims', {
      mode: 'json',
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revoked: integer('revoked', { mode: 'timestamp_ms' }),
    rotatedAt: integer('rotated_at', { mode: 'timestamp_ms' }),
    rotationReplayResponse: text('rotation_replay_response'),
    rotationReplayExpiresAt: integer('rotation_replay_expires_at', {
      mode: 'timestamp_ms',
    }),
    authTime: integer('auth_time', { mode: 'timestamp_ms' }),
    confirmation: text('confirmation', { mode: 'json' }),
    scopes: text('scopes', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('oauthRefreshToken_clientId_idx').on(table.clientId),
    index('oauthRefreshToken_sessionId_idx').on(table.sessionId),
    index('oauthRefreshToken_userId_idx').on(table.userId),
    index('oauthRefreshToken_authorizationCodeId_idx').on(
      table.authorizationCodeId,
    ),
  ],
)

export const oauthAccessToken = sqliteTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => session.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources', { mode: 'json' }),
    requestedUserInfoClaims: text('requested_user_info_claims', {
      mode: 'json',
    }),
    refreshId: text('refresh_id').references(() => oauthRefreshToken.id, {
      onDelete: 'cascade',
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revoked: integer('revoked', { mode: 'timestamp_ms' }),
    confirmation: text('confirmation', { mode: 'json' }),
    scopes: text('scopes', { mode: 'json' }).notNull(),
  },
  (table) => [
    index('oauthAccessToken_clientId_idx').on(table.clientId),
    index('oauthAccessToken_sessionId_idx').on(table.sessionId),
    index('oauthAccessToken_userId_idx').on(table.userId),
    index('oauthAccessToken_authorizationCodeId_idx').on(
      table.authorizationCodeId,
    ),
    index('oauthAccessToken_refreshId_idx').on(table.refreshId),
  ],
)

export const oauthConsent = sqliteTable(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    resources: text('resources', { mode: 'json' }),
    requestedUserInfoClaims: text('requested_user_info_claims', {
      mode: 'json',
    }),
    scopes: text('scopes', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('oauthConsent_clientId_idx').on(table.clientId),
    index('oauthConsent_userId_idx').on(table.userId),
  ],
)

export const oauthClientAssertion = sqliteTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  twoFactors: many(twoFactor),
  categorys: many(category),
  channels: many(channel),
  notificationDeliverys: many(notificationDelivery),
  costSnapshots: many(costSnapshot),
  incomeSources: many(incomeSource),
  notifications: many(notification),
  paymentMethods: many(paymentMethod),
  userSetting: one(userSetting),
  subscriptions: many(subscription),
  oauthClients: many(oauthClient),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}))

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}))

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}))

export const categoryRelations = relations(category, ({ one, many }) => ({
  user: one(user, {
    fields: [category.userId],
    references: [user.id],
  }),
  subscriptions: many(subscription),
}))

export const channelRelations = relations(channel, ({ one, many }) => ({
  user: one(user, {
    fields: [channel.userId],
    references: [user.id],
  }),
  notificationDeliverys: many(notificationDelivery),
}))

export const notificationDeliveryRelations = relations(
  notificationDelivery,
  ({ one }) => ({
    notification: one(notification, {
      fields: [notificationDelivery.notificationId],
      references: [notification.id],
    }),
    channel: one(channel, {
      fields: [notificationDelivery.channelId],
      references: [channel.id],
    }),
    user: one(user, {
      fields: [notificationDelivery.userId],
      references: [user.id],
    }),
  }),
)

export const costSnapshotRelations = relations(costSnapshot, ({ one }) => ({
  user: one(user, {
    fields: [costSnapshot.userId],
    references: [user.id],
  }),
}))

export const incomeSourceRelations = relations(incomeSource, ({ one }) => ({
  user: one(user, {
    fields: [incomeSource.userId],
    references: [user.id],
  }),
}))

export const notificationRelations = relations(
  notification,
  ({ one, many }) => ({
    subscription: one(subscription, {
      fields: [notification.subscriptionId],
      references: [subscription.id],
    }),
    user: one(user, {
      fields: [notification.userId],
      references: [user.id],
    }),
    notificationDeliverys: many(notificationDelivery),
  }),
)

export const paymentMethodRelations = relations(
  paymentMethod,
  ({ one, many }) => ({
    user: one(user, {
      fields: [paymentMethod.userId],
      references: [user.id],
    }),
    subscriptions: many(subscription),
  }),
)

export const userSettingRelations = relations(userSetting, ({ one }) => ({
  user: one(user, {
    fields: [userSetting.userId],
    references: [user.id],
  }),
}))

export const subscriptionRelations = relations(
  subscription,
  ({ one, many }) => ({
    category: one(category, {
      fields: [subscription.categoryId],
      references: [category.id],
    }),
    paymentMethod: one(paymentMethod, {
      fields: [subscription.paymentMethodId],
      references: [paymentMethod.id],
    }),
    user: one(user, {
      fields: [subscription.userId],
      references: [user.id],
    }),
    notifications: many(notification),
  }),
)

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
  oauthClientResources: many(oauthClientResource),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}))

export const oauthResourceRelations = relations(oauthResource, ({ many }) => ({
  oauthClientResources: many(oauthClientResource),
}))

export const oauthClientResourceRelations = relations(
  oauthClientResource,
  ({ one }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthClientResource.clientId],
      references: [oauthClient.clientId],
    }),
    oauthResource: one(oauthResource, {
      fields: [oauthClientResource.resourceId],
      references: [oauthResource.identifier],
    }),
  }),
)

export const oauthRefreshTokenRelations = relations(
  oauthRefreshToken,
  ({ one, many }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthRefreshToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthRefreshToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthRefreshToken.userId],
      references: [user.id],
    }),
    oauthAccessTokens: many(oauthAccessToken),
  }),
)

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthAccessToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthAccessToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
    oauthRefreshToken: one(oauthRefreshToken, {
      fields: [oauthAccessToken.refreshId],
      references: [oauthRefreshToken.id],
    }),
  }),
)

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}))
