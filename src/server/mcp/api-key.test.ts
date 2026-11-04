import { describe, expect, it } from 'vitest'
import { apiKeyFromRequest } from './api-key'

function request(headers: Record<string, string>) {
  return new Request('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers,
  })
}

describe('apiKeyFromRequest', () => {
  it('reads x-api-key', () => {
    expect(apiKeyFromRequest(request({ 'x-api-key': 'alpha-key' }))).toBe(
      'alpha-key',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(apiKeyFromRequest(request({ 'x-api-key': '  alpha-key  ' }))).toBe(
      'alpha-key',
    )
  })

  it('accepts an opaque bearer token as a key', () => {
    expect(
      apiKeyFromRequest(request({ authorization: 'Bearer beta-key' })),
    ).toBe('beta-key')
  })

  it('leaves JWT access tokens to the OAuth flow', () => {
    expect(
      apiKeyFromRequest(
        request({ authorization: 'Bearer header.payload.signature' }),
      ),
    ).toBeNull()
  })

  it('prefers x-api-key over a bearer token', () => {
    expect(
      apiKeyFromRequest(
        request({
          'x-api-key': 'header-key',
          authorization: 'Bearer bearer-key',
        }),
      ),
    ).toBe('header-key')
  })

  it('returns null without credentials', () => {
    expect(apiKeyFromRequest(request({}))).toBeNull()
  })
})
