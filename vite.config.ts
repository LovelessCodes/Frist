import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Surfaced in the sidebar (and the MCP server banner) so a screenshot
  // answers "which release is this?" without opening the container.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    {
      // better-auth rate limits per client IP (single-value x-forwarded-for);
      // Vite's dev server has no such header, so provide the socket address
      // like serve.ts does in production.
      name: 'frist-client-ip',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const address = req.socket.remoteAddress
          if (address) {
            req.headers['x-forwarded-for'] = address
          }
          next()
        })
      },
    },
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    // Frist accepts any host in production (dynamic base URL); the dev
    // server should not be stricter than the real thing.
    allowedHosts: true,
    // Vite auto-enables client-console forwarding to the terminal when it
    // detects an agent environment. Combined with TanStack Devtools' virtual
    // console (which captures the server process console and echoes it back
    // into the browser as `[Server] …`), that closes a relay: browser log →
    // terminal → devtools echo → browser log → … Each lap re-wraps the
    // message, so a single console.error can balloon to gigabytes of output
    // and kill the dev server (ENOBUFS). Keep browser logs in the browser.
    forwardConsole: false,
  },
})

export default config
