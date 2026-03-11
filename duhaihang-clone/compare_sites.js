/**
 * Compares local (127.0.0.1:8080) vs live (duhaihang.com)
 * Captures screenshots and console errors.
 * Run: node compare_sites.js
 */
const { chromium } = require('playwright');
const path = require('path');

const LOCAL_URL = 'http://127.0.0.1:8080';
const LIVE_URL = 'https://duhaihang.com/';
const LOAD_WAIT_MS = 12000; // Wait for loading animation

async function capturePage(page, url, label) {
  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push(text);
    }
    consoleLogs.push({ type, text });
  });

  console.log(`\nNavigating to ${url}...`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    return { error: e.message, screenshot: null, consoleErrors: [e.message] };
  }

  console.log(`Waiting ${LOAD_WAIT_MS / 1000}s for loading animation...`);
  await page.waitForTimeout(LOAD_WAIT_MS);

  // Scroll to trigger any lazy content
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const screenshotPath = path.join(__dirname, `screenshot_${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved: ${screenshotPath}`);

  return { screenshot: screenshotPath, consoleErrors, consoleLogs };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  const local = await capturePage(page, LOCAL_URL, 'local');
  const live = await capturePage(page, LIVE_URL, 'live');

  await browser.close();

  // Report
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON REPORT');
  console.log('='.repeat(60));

  console.log('\n--- LOCAL (127.0.0.1:8080) ---');
  if (local.error) {
    console.log('ERROR:', local.error);
    console.log('(Local server may not be running)');
  } else {
    console.log('Screenshot:', local.screenshot);
    if (local.consoleErrors.length > 0) {
      console.log('\nConsole ERRORS:');
      local.consoleErrors.forEach((e) => console.log('  -', e));
    } else {
      console.log('Console errors: none');
    }
  }

  console.log('\n--- LIVE (duhaihang.com) ---');
  console.log('Screenshot:', live.screenshot);
  if (live.consoleErrors && live.consoleErrors.length > 0) {
    console.log('Console errors:', live.consoleErrors.length);
  } else {
    console.log('Console errors: none');
  }

  console.log('\n--- VERDICT ---');
  if (local.error) {
    console.log('Local site: FAILED -', local.error);
  } else if (local.consoleErrors.length > 0) {
    console.log('Local site: HAS CONSOLE ERRORS (see above)');
  } else {
    console.log('Local site: No console errors detected');
  }
  console.log('\nScreenshots saved to duhaihang-clone folder. Compare visually.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
