// Gera as artes NFT otimizadas (WebP) a partir dos assets originais exportados do Figma.
// Fonte: design-assets/figma/*.png (1254x1254, exportados do arquivo Frontend Challenge)
// Saída: public/images/nfts/nft-{1..16}.webp (900x900 — nítido em telas 2x para o slot de 450px)
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'design-assets', 'figma')
const outDir = path.join(root, 'public', 'images', 'nfts')

// Ordem dos artworks do Figma: Frame 136 (hero), NFT Artwork 18, 05 e 09
const artworks = ['emerald-ape.png', 'bucket-hat-ape.png', 'turtleneck-ape.png', 'headphones-ape.png']

await mkdir(outDir, { recursive: true })

for (let n = 1; n <= 16; n++) {
  const source = path.join(srcDir, artworks[(n - 1) % artworks.length])
  const target = path.join(outDir, `nft-${n}.webp`)
  await sharp(source).resize(900, 900, { fit: 'cover' }).webp({ quality: 86, effort: 6 }).toFile(target)
  console.log(`✔ ${path.relative(root, target)}`)
}
