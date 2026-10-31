// QA harness: loads each site in headless chromium, captures console + errors,
// screenshots idle / flash / recover states, reports WebGL + window.__stats.
// usage: node tools/qa.mjs <sitePath...> [--settle ms] [--w 1600] [--h 900] [--out dir]
import { mkdirSync, readdirSync } from 'node:fs';
const libDirs = readdirSync('/tmp/chromelibs', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => `/tmp/chromelibs/${d.name}`);
process.env.LD_LIBRARY_PATH = [...libDirs, process.env.LD_LIBRARY_PATH || ''].join(':');
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';

const { chromium } = await import('playwright');


const args = process.argv.slice(2);
const settleIdx = args.indexOf('--settle');
const settle = settleIdx > -1 ? Number(args[settleIdx + 1]) : 2500;
const wIdx = args.indexOf('--w'); const W = wIdx > -1 ? Number(args[wIdx + 1]) : 1600;
const hIdx = args.indexOf('--h'); const H = hIdx > -1 ? Number(args[hIdx + 1]) : 900;
const outIdx = args.indexOf('--out');
const OUT = outIdx > -1 ? args[outIdx + 1] : '/workspace/flsh/qa/shots';
const skipVals = new Set([settleIdx + 1, wIdx + 1, hIdx + 1, outIdx + 1].filter(i => i >= 0));
const sites = args.filter(a => !a.startsWith('--') && !['2500', '1600', '900', '/workspace/flsh/qa/shots'].includes(a) && isNaN(Number(a)));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/tmp/chrome-wrapper.sh',
  timeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const report = {};
for (const site of sites) {
  const name = site.replace(/^\/?/, '').replace(/\//g, '_') || 'root';
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
  const t0 = Date.now();
  try {
    await page.goto(`http://127.0.0.1:8734/${site}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // dismiss boot screens generically: click center if a boot overlay exists
    const hasBoot = await page.evaluate(() => !!document.querySelector('#boot, div[style*="z-index:100"], div[style*="z-index: 100"]') || [...document.querySelectorAll('div')].some(d => /click to deploy|press any key/i.test(d.textContent || '') && getComputedStyle(d).position === 'fixed'));
    if (hasBoot) { await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(900); }
    await page.waitForFunction(() => window.__ready === true, { timeout: 20000 }).catch(() => logs.push('[warn] __ready never set'));
    await page.waitForTimeout(settle);
    const info = await page.evaluate(() => ({
      webgl: !!document.createElement('canvas').getContext('webgl2'),
      stats: window.__stats || null,
      title: document.title,
      h1: document.querySelector('h1')?.textContent || null,
    })).catch(e => ({ err: String(e) }));
    await page.screenshot({ path: `${OUT}/${name}-1-idle.png` });
    // trigger the flash: click, then poll until intensity peaks, then capture
    await page.mouse.click(W / 2, H / 2);
    await page.waitForFunction(() => (window.__stats?.flashIntensity || window.__stats?.flashEnv || 0) > 0.5, { timeout: 15000 }).catch(() => logs.push('[warn] flash intensity never exceeded 0.5'));
    await page.screenshot({ path: `${OUT}/${name}-2-flash.png` });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}-3-recover.png` });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window.__stats?.flashIntensity || window.__stats?.flashEnv || 0) > 0.5, { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${name}-4-space.png` });
    const after = await page.evaluate(() => window.__stats || null).catch(() => null);
    report[name] = { ms: Date.now() - t0, info, after, logs };
  } catch (e) {
    report[name] = { error: String(e), logs };
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
