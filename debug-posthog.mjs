import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext();
const page = await context.newPage();

const consoleLogs = [];
const networkRequests = [];

page.on('console', msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`);
});

page.on('request', req => {
  if (req.url().includes('posthog')) {
    networkRequests.push({ url: req.url(), method: req.method() });
    console.log(`NETWORK REQ: ${req.method()} ${req.url()}`);
  }
});

page.on('response', resp => {
  if (resp.url().includes('posthog')) {
    console.log(`NETWORK RESP: ${resp.status()} ${resp.url()}`);
  }
});

// Step 1: Load page and clear localStorage
console.log('\n=== STEP 1: Clear localStorage and reload ===');
await page.goto('http://localhost:5173/');
await page.waitForTimeout(2000);

const beforeClear = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    items[key] = localStorage.getItem(key);
  }
  return items;
});
console.log('localStorage BEFORE clear:', JSON.stringify(beforeClear));

await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(3000);

// Step 2: Check state after reload
console.log('\n=== STEP 2: State after reload (no consent) ===');
const afterReload = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    items[key] = localStorage.getItem(key);
  }
  return items;
});
console.log('localStorage after reload:', JSON.stringify(afterReload));

// Check if PostHog is initialized
const phState = await page.evaluate(() => {
  try {
    const ph = window.posthog;
    if (!ph) return 'window.posthog is undefined';
    return {
      loaded: ph.__loaded,
      optedOut: ph.has_opted_out_capturing ? ph.has_opted_out_capturing() : 'method missing',
      optedIn: ph.has_opted_in_capturing ? ph.has_opted_in_capturing() : 'method missing',
      distinctId: ph.get_distinct_id ? ph.get_distinct_id() : 'method missing',
    };
  } catch (e) {
    return 'Error: ' + e.message;
  }
});
console.log('PostHog state after reload:', JSON.stringify(phState, null, 2));

// Step 3: Find and click consent Accept button
console.log('\n=== STEP 3: Click Accept ===');
const consentBtn = await page.$('button:has-text("Accept")');
if (consentBtn) {
  await consentBtn.click();
  await page.waitForTimeout(2000);
  console.log('Clicked Accept');
} else {
  console.log('ERROR: No Accept button found! Page content:');
  console.log(await page.content().then(c => c.substring(0, 500)));
}

// Step 4: Check PostHog state after accept
console.log('\n=== STEP 4: PostHog state after Accept ===');
const phStateAfter = await page.evaluate(() => {
  try {
    const ph = window.posthog;
    if (!ph) return 'window.posthog is undefined';
    return {
      loaded: ph.__loaded,
      optedOut: ph.has_opted_out_capturing ? ph.has_opted_out_capturing() : 'method missing',
      optedIn: ph.has_opted_in_capturing ? ph.has_opted_in_capturing() : 'method missing',
      distinctId: ph.get_distinct_id ? ph.get_distinct_id() : 'method missing',
    };
  } catch (e) {
    return 'Error: ' + e.message;
  }
});
console.log('PostHog state after Accept:', JSON.stringify(phStateAfter, null, 2));

const lsAfterAccept = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    items[key] = localStorage.getItem(key);
  }
  return items;
});
console.log('localStorage after Accept:', JSON.stringify(lsAfterAccept, null, 2));

// Step 5: Try to manually fire a capture
console.log('\n=== STEP 5: Manual capture test ===');
const captureResult = await page.evaluate(() => {
  try {
    const ph = window.posthog;
    if (!ph) return 'posthog not on window';
    ph.capture('debug_test_event', { source: 'playwright_debug' });
    return 'capture called OK';
  } catch (e) {
    return 'capture threw: ' + e.message;
  }
});
console.log('Manual capture result:', captureResult);
await page.waitForTimeout(2000);

// Step 6: Click Submit Photo button
console.log('\n=== STEP 6: Click Submit Photo ===');
const submitBtn = await page.$('button:has-text("Submit Photo")');
if (submitBtn) {
  await submitBtn.click();
  await page.waitForTimeout(2000);
  console.log('Clicked Submit Photo');
} else {
  console.log('No Submit Photo button found. Looking for challenges...');
  const btns = await page.$$eval('button', bs => bs.map(b => b.textContent?.trim()));
  console.log('All buttons:', JSON.stringify(btns));
}

// Step 7: Check opt-in via posthog-js react context
console.log('\n=== STEP 7: Deep PostHog diagnostic ===');
const deep = await page.evaluate(() => {
  try {
    const ph = window.posthog;
    return {
      loaded: ph.__loaded,
      config: {
        opt_out_capturing_by_default: ph.config?.opt_out_capturing_by_default,
        disable_persistence: ph.config?.disable_persistence,
      },
      persistence: {
        optOut: ph.persistence?.props?.['__ph_opt_in_out_phc_AUvHwWYX4YVAgF769wQqTPNHa3bThqqD8Ym2n9yTv9jT'],
      },
      optedOut: ph.has_opted_out_capturing(),
      optedIn: ph.has_opted_in_capturing(),
    };
  } catch(e) {
    return 'Error: ' + e.message;
  }
});
console.log('Deep PostHog diagnostic:', JSON.stringify(deep, null, 2));

console.log('\n=== NETWORK REQUESTS TO POSTHOG ===');
console.log(JSON.stringify(networkRequests, null, 2));

await page.waitForTimeout(3000);
await browser.close();
