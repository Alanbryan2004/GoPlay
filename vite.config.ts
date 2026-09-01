import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin que atualiza version.json automaticamente a cada build
// Garante que o VersionGuard detecte novas versões e recarregue os clientes
function autoVersionPlugin(): Plugin {
  return {
    name: 'auto-version',
    buildStart() {
      const versionPath = path.resolve(__dirname, 'public/version.json')
      const now = new Date()
      const version = [
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate()
      ].join('.') + '-' + [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '00'),
        String(now.getSeconds()).padStart(2, '00')
      ].join('')

      const content = JSON.stringify({ version, buildTime: now.toISOString() }, null, 2) + '\n'
      fs.writeFileSync(versionPath, content, 'utf-8')
      console.log(`\n🔄 [AutoVersion] version.json atualizado → v${version}\n`)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), autoVersionPlugin()],
  optimizeDeps: {
    include: ['html2canvas-pro']
  }
})
