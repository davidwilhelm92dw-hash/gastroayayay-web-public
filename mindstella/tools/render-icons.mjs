/**
 * Erzeugt App-Symbole und Startbilder für Android aus dem Mindstella-Zeichen.
 * Aufruf: node tools/render-icons.mjs (benötigt Playwright mit Chromium)
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const RES = 'android/app/src/main/res';
const BG = '#141b26';
const font = readFileSync('node_modules/@fontsource/jost/files/jost-latin-400-normal.woff2').toString('base64');

const signet = (fill = '#e9b872', moon = '#a9c3d6') => `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
  <path d="M32 6 C33.2 18 35.5 22.6 46 25 C35.5 27.4 33.2 32 32 44 C30.8 32 28.5 27.4 18 25 C28.5 22.6 30.8 18 32 6 Z" fill="${fill}"/>
  <circle cx="47.5" cy="12.5" r="2.6" fill="${moon}"/>
  <path d="M8 56 Q32 41 56 56" fill="none" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>
</svg>`;

function pngSize(file) {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(file, w, h, body, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Jost; src: url(data:font/woff2;base64,${font}) format('woff2'); }
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : BG}}
    .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  </style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: transparent });
}

for (const dir of readdirSync(RES).filter((d) => d.startsWith('mipmap-') && !d.includes('anydpi'))) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const file = path.join(RES, dir, name);
    if (!existsSync(file)) continue;
    const [w] = pngSize(file);
    if (name === 'ic_launcher_foreground.png') {
      // adaptives Symbol: Zeichen innerhalb der sicheren Zone (66 von 108 dp)
      await render(file, w, w, `<div class="c"><div style="width:${w * 0.5}px;height:${w * 0.5}px">${signet()}</div></div>`, true);
    } else {
      const radius = name.includes('round') ? '50%' : '18%';
      await render(
        file,
        w,
        w,
        `<div style="position:absolute;inset:0;border-radius:${radius};background:${BG}"></div><div class="c"><div style="width:${w * 0.68}px;height:${w * 0.68}px">${signet()}</div></div>`,
        true
      );
    }
  }
}

for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const file = path.join(RES, dir, 'splash.png');
  if (!existsSync(file)) continue;
  const [w, h] = pngSize(file);
  const s = Math.min(w, h) * 0.22;
  await render(
    file,
    w,
    h,
    `<div class="c"><div style="width:${s}px;height:${s}px">${signet()}</div><div style="font-family:Jost;color:#f6f1e7;text-transform:uppercase;letter-spacing:.3em;margin-right:-.3em;font-size:${s * 0.3}px;margin-top:${s * 0.12}px">Mindstella</div></div>`
  );
}
await browser.close();
console.log('Symbole und Startbilder erzeugt.');
