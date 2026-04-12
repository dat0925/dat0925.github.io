import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const distDir = resolve(__dirname, 'dist')

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first')
  process.exit(1)
}

// Copy dist/index.html → gantt-app.html
copyFileSync(
  resolve(distDir, 'index.html'),
  resolve(repoRoot, 'gantt-app.html')
)
console.log('✅ Copied dist/index.html → gantt-app.html')

// Copy dist/gantt-assets/ → gantt-assets/
const assetsOut = resolve(repoRoot, 'gantt-assets')
if (existsSync(assetsOut)) {
  rmSync(assetsOut, { recursive: true, force: true })
}
cpSync(resolve(distDir, 'gantt-assets'), assetsOut, { recursive: true })
console.log('✅ Copied dist/gantt-assets/ → gantt-assets/')

// Copy icon.png if present
const iconSrc = resolve(distDir, 'icon.png')
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, resolve(repoRoot, 'icon.png'))
  console.log('✅ Copied dist/icon.png → icon.png')
}

console.log('\nDeploy complete! Files ready to commit and push.')
