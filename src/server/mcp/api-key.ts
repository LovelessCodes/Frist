/** The header Better Auth's API-key plugin reads by default. */
export const API_KEY_HEADER = 'x-api-key'

/**
 * An API key presented with an MCP request, if any.
 *
 * `x-api-key` is the documented way in. Some MCP clients only allow a bearer
 * token, so a non-JWT `Authorization: Bearer` value is treated as a key too —
 * OAuth access tokens are JWTs (three dot-separated segments) and stay on the
 * OAuth path.
 */
export function apiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get(API_KEY_HEADER)?.trim()
  if (header) return header

  const bearer = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(\S+)\s*$/i)?.[1]
  if (!bearer || bearer.split('.').length === 3) return null
  return bearer
}
