/**
 * The release version, injected at build time by Vite from package.json.
 * The fallback keeps unit tests and tooling (which never run the Vite
 * define step) from blowing up.
 */
declare global {
  const __APP_VERSION__: string
}

export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : 'dev'
