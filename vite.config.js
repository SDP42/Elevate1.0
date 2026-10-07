import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import apiPlugin from './vite.api-plugin.js'

// Git ignores do not restrict the dev server's file endpoints.
export const privateFileDeny = ['.env', '.env.*', '*.{crt,pem}', '**/.git/**',
  '**/.local-rsvp/**', '**/.local-release-check/**',
  '**/*credentials*.{json,csv}', '**/elevate-accounts.csv']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { fs: { deny: privateFileDeny } },
})
