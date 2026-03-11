/**
 * Captures all network requests and DOM media elements from duhaihang.com
 * Run: node capture_assets.js
 */
const { chromium } = require('playwright');

const TARGET_DOMAIN = 'duhaihang.com';
const PAGE_URL = 'https://duhaihang.com/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const requestedUrls = new Set();
  const requestedUrlsByType = {};

  // Capture all requests
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes(TARGET_DOMAIN)) {
      requestedUrls.add(url);
      const resourceType = request.resourceType();
      if (!requestedUrlsByType[resourceType]) requestedUrlsByType[resourceType] = new Set();
      requestedUrlsByType[resourceType].add(url);
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes(TARGET_DOMAIN)) {
      requestedUrls.add(url);
    }
  });

  console.log('Navigating to', PAGE_URL, '...\n');
  await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for animations to complete (portfolio sites often have delayed loads)
  console.log('Waiting 8 seconds for animations and lazy loads...');
  await page.waitForTimeout(8000);

  // Trigger any lazy-loaded content by scrolling
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  // Get DOM elements: img, video, canvas, source
  const domMedia = await page.evaluate(() => {
    const results = { img: [], video: [], canvas: [], source: [], svg: [] };

    document.querySelectorAll('img[src]').forEach((el) => {
      results.img.push({ src: el.src, alt: el.alt || '' });
    });
    document.querySelectorAll('video source[src]').forEach((el) => {
      const src = el.src || el.getAttribute('src');
      if (src) results.video.push({ src });
    });
    document.querySelectorAll('video[src]').forEach((el) => {
      if (el.src) results.video.push({ src: el.src });
    });
    document.querySelectorAll('canvas').forEach((el, i) => {
      results.canvas.push({ index: i, width: el.width, height: el.height });
    });
    document.querySelectorAll('source[src]').forEach((el) => {
      results.source.push({ src: el.src, type: el.type || '' });
    });
    document.querySelectorAll('svg').forEach((el, i) => {
      const imgEl = el.querySelector('[xlink\\:href], [href]');
      results.svg.push({
        index: i,
        hasImageHref: !!imgEl,
        href: imgEl ? (imgEl.getAttribute('xlink:href') || imgEl.getAttribute('href') || '') : '',
      });
    });

    return results;
  });

  await browser.close();

  // Output
  const sortedUrls = Array.from(requestedUrls).sort();
  const duhaihangOnly = sortedUrls.filter((u) => u.includes(TARGET_DOMAIN));

  console.log('\n========== ALL URLs FROM duhaihang.com ==========\n');
  duhaihangOnly.forEach((u) => console.log(u));

  console.log('\n========== BY RESOURCE TYPE ==========\n');
  for (const [type, urls] of Object.entries(requestedUrlsByType)) {
    console.log(`\n--- ${type} ---`);
    Array.from(urls)
      .sort()
      .forEach((u) => console.log(u));
  }

  console.log('\n========== DOM: img, video, canvas, source ==========\n');
  console.log(JSON.stringify(domMedia, null, 2));

  console.log('\n========== SUMMARY ==========\n');
  console.log('Total unique duhaihang.com URLs:', duhaihangOnly.length);
  console.log('Images in DOM:', domMedia.img.length);
  console.log('Videos in DOM:', domMedia.video.length);
  console.log('Canvas elements:', domMedia.canvas.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
