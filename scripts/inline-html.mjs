import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const assetDir = resolve(dist, 'assets')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const assets = readdirSync(assetDir)
const scripts = assets.filter((name) => name.endsWith('.js'))
const styles = assets.filter((name) => name.endsWith('.css'))
const images = assets.filter((name) => name.endsWith('.webp') || name.endsWith('.png') || name.endsWith('.svg'))

if (scripts.length !== 1 || styles.length !== 1) {
  throw new Error(`단일 번들이 아닙니다. js ${scripts.length}개, css ${styles.length}개`)
}

let js = readFileSync(resolve(assetDir, scripts[0]), 'utf8')
const css = readFileSync(resolve(assetDir, styles[0]), 'utf8')

for (const image of images) {
  const data = readFileSync(resolve(assetDir, image)).toString('base64')
  const mime = image.endsWith('.svg') ? 'image/svg+xml' : image.endsWith('.png') ? 'image/png' : 'image/webp'
  const uri = `data:${mime};base64,${data}`
  js = js.split(`./assets/${image}`).join(uri).split(`/assets/${image}`).join(uri).split(`assets/${image}`).join(uri)
}

function page(screen) {
  const withStyle = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+">/, () => `<style>\n${css}\n</style>`)
  const withScript = withStyle.replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>/,
    () => `<script>window.__NURSING_SCREEN__=${JSON.stringify(screen)}</script>\n<script type="module">\n${js}\n</script>`,
  )
  if (withScript.includes('./assets/') || withScript.includes('/assets/')) {
    throw new Error(`${screen} HTML에 빌드 자산 경로가 남아 있습니다.`)
  }
  return withScript
}

const out = resolve(root, 'export')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'nursing_ver1.html'), page('ver1'))
writeFileSync(resolve(out, 'nursing_ver2.html'), page('ver2'))
console.log('export/nursing_ver1.html')
console.log('export/nursing_ver2.html')
