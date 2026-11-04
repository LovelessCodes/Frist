import { requireMcpAuth } from '@better-auth/mcp'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { auth, mcpResource } from '../../lib/auth'
import { apiKeyFromRequest } from './api-key'
import { createFristMcpServer } from './server'

const mcpHandler = createMcpHandler(
  (ctx) => createFristMcpServer(ctx.authInfo),
  { legacy: 'reject' },
)

const oauthPost = requireMcpAuth(
  auth,
  (request, claims) =>
    mcpHandler.fetch(request, {
      authInfo: {
        token:
          request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
          '',
        clientId: typeof claims.client_id === 'string' ? claims.client_id : '',
        scopes: typeof claims.scope === 'string' ? claims.scope.split(' ') : [],
        extra: { userId: claims.sub },
      },
    }),
  {
    resource: mcpResource,
    requiredScopes: ['mcp:read'],
  },
)

/**
 * API keys go through Better Auth's session lookup (the api-key plugin runs
 * with `enableSessionForAPIKeys`), so a key resolves to the same user a
 * cookie would. Returns null for a missing or invalid key, which leaves the
 * request on the OAuth path.
 */
async function userIdFromApiKey(key: string): Promise<string | null> {
  try {
    const session = await auth.api.getSession({
      headers: new Headers({ 'x-api-key': key }),
    })
    return session?.user.id ?? null
  } catch {
    return null
  }
}

export async function handleMcpPost(request: Request) {
  const key = apiKeyFromRequest(request)
  const userId = key ? await userIdFromApiKey(key) : null

  if (key && userId) {
    return mcpHandler.fetch(request, {
      authInfo: {
        token: key,
        clientId: 'frist-api-key',
        scopes: ['mcp:read'],
        extra: { userId },
      },
    })
  }

  return oauthPost(request)
}
