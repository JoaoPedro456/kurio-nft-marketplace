import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')
const outNfts = path.join(rootDir, 'public/images/nfts')
const outUi = path.join(rootDir, 'public/images/ui')
const outAvatars = path.join(rootDir, 'public/images/avatars')

fs.mkdirSync(outNfts, { recursive: true })
fs.mkdirSync(outUi, { recursive: true })
fs.mkdirSync(outAvatars, { recursive: true })

// Copy MSW service worker from node_modules
const mswWorkerSrc = path.join(rootDir, 'node_modules/msw/lib/mockServiceWorker.js')
const mswWorkerDest = path.join(rootDir, 'public/mockServiceWorker.js')
if (fs.existsSync(mswWorkerSrc)) {
  fs.copyFileSync(mswWorkerSrc, mswWorkerDest)
  console.log('Copied mockServiceWorker.js to public/mockServiceWorker.js')
}

const assets = [
  { url: 'https://www.figma.com/api/mcp/asset/a12f383a-ede0-4440-bad3-d88baa94d2f9.png', dest: path.join(outNfts, 'nft-1.png') },
  { url: 'https://www.figma.com/api/mcp/asset/eb9b0f53-42fe-4d42-b425-64f16b818d13.png', dest: path.join(outNfts, 'nft-2.png') },
  { url: 'https://www.figma.com/api/mcp/asset/faa0ce7b-a107-4527-8e5f-66cee63fa96f.png', dest: path.join(outNfts, 'nft-3.png') },
  { url: 'https://www.figma.com/api/mcp/asset/5b953e06-cdb6-4a4b-982d-c28dd1ed3d66.png', dest: path.join(outNfts, 'nft-4.png') },
  { url: 'https://www.figma.com/api/mcp/asset/864eb1f3-b277-48b7-8efb-ad9b0e0cffcb.png', dest: path.join(outNfts, 'nft-5.png') },
  { url: 'https://www.figma.com/api/mcp/asset/10c68c55-77cc-4d59-a586-b522ae421255.png', dest: path.join(outNfts, 'nft-6.png') },
  { url: 'https://www.figma.com/api/mcp/asset/1d421f2d-bf48-42df-9a25-e6690ee7e87a.png', dest: path.join(outNfts, 'nft-7.png') },
  { url: 'https://www.figma.com/api/mcp/asset/ff975000-42d1-43e1-8c55-91246c751e12.png', dest: path.join(outNfts, 'nft-8.png') },
  { url: 'https://www.figma.com/api/mcp/asset/1b9c0a78-b7be-43b6-bc40-b8036ffb95fa.svg', dest: path.join(outUi, 'thank-you.svg') },
  { url: 'https://www.figma.com/api/mcp/asset/881fbfc5-08c2-4feb-aea8-52d54e88c3c9.svg', dest: path.join(outUi, 'promo-mask.svg') },
]

for (const item of assets) {
  console.log(`Downloading ${item.url} -> ${item.dest}`)
  const res = await fetch(item.url)
  if (!res.ok) {
    throw new Error(`Failed to download ${item.url}: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(item.dest, buf)
}

for (let i = 9; i <= 16; i++) {
  const srcIndex = ((i - 1) % 8) + 1
  fs.copyFileSync(path.join(outNfts, `nft-${srcIndex}.png`), path.join(outNfts, `nft-${i}.png`))
}

const avatarProfiles = [
  { file: 'creator-1.svg', initials: 'NS', bg: '#2F1D15', accent: '#E89B55' },
  { file: 'creator-2.svg', initials: 'KV', bg: '#241612', accent: '#D28A4C' },
  { file: 'creator-3.svg', initials: 'LR', bg: '#38220F', accent: '#F0805F' },
  { file: 'creator-4.svg', initials: 'OZ', bg: '#2F1D15', accent: '#CFB28C' },
  { file: 'user-1.svg', initials: 'AC', bg: '#2F1D15', accent: '#D28A4C' },
  { file: 'user-2.svg', initials: 'BM', bg: '#241612', accent: '#E89B55' },
]

for (const av of avatarProfiles) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <rect width="80" height="80" rx="40" fill="${av.bg}" stroke="${av.accent}" stroke-width="2"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#F5F1EB" font-family="monospace" font-weight="700" font-size="26">${av.initials}</text>
</svg>`
  fs.writeFileSync(path.join(outAvatars, av.file), svg, 'utf8')
}

console.log('All Figma assets downloaded and saved locally.')
