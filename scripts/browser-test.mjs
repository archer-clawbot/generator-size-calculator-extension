import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// These checks load the real Manifest V3 extension. No Chrome storage API or
// application calculation is mocked. Only the native print dialog is suppressed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = process.env.EXTENSION_PATH
  ? resolve(process.env.EXTENSION_PATH)
  : resolve(root, 'extension');
const profile = await mkdtemp(resolve(tmpdir(), 'generator-extension-test-'));
const failures = [];
const externalRequests = [];
let context;
let completed = 0;

const check = async (name, run) => {
  await run();
  completed++;
  console.log(`PASS ${name}`);
};

const watchPage = page => {
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon')) {
      failures.push(message.text());
    }
  });
};

const equalText = async (page, selector, expected) => {
  await page.waitForFunction(({ selector, expected }) =>
    document.querySelector(selector)?.textContent.trim() === expected,
  { selector, expected });
};

const saved = async page => {
  await equalText(page, '#save-status', 'Plan saved on this device');
};

const readSaved = page => page.evaluate(async () =>
  (await chrome.storage.local.get('generatorPlanV1')).generatorPlanV1);

const exportDisabled = async page => {
  for (const selector of ['#download', '#copy', '#print']) {
    assert.equal(await page.locator(selector).isDisabled(), true, `${selector} must reject an invalid draft`);
  }
  await equalText(page, '#required-kw', '—');
};

const loadPage = async (url, { restored = true } = {}) => {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.load-row').length > 0
    && !document.querySelector('#blank-plan').disabled);
  if (restored) await equalText(page, '#save-status', 'Plan restored from this device');
  return page;
};

try {
  context = await chromium.launchPersistentContext(profile, {
    headless: process.env.HEADED !== '1',
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : { channel: 'chromium' }),
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    acceptDownloads: true,
  });
  context.setDefaultTimeout(10_000);
  context.on('page', watchPage);
  context.on('request', request => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  await context.addInitScript(() => {
    window.__printInvocations = 0;
    window.print = () => { window.__printInvocations++; };
  });

  // The extension has no background worker by design. Chrome's own extension
  // management page exposes the real ID and also detects manifest-load failures.
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  const extensions = await manager.evaluate(() => new Promise((resolveInfo, reject) => {
    chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true }, info => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolveInfo(info);
    });
  }));
  const installed = extensions.find(info => info.name === 'Generator Size Calculator — Backup Generator Guide');
  assert.ok(installed, 'Chrome did not load the unpacked extension. Run npx playwright install chromium.');
  assert.equal(installed.state, 'ENABLED');
  assert.deepEqual(installed.manifestErrors ?? [], [], 'Extension manifest must load without errors');
  const extensionURL = `chrome-extension://${installed.id}/index.html`;
  await manager.close();
  const page = await loadPage(extensionURL, { restored: false });

  await check('loaded extension shows the original example totals and local storage status', async () => {
    await equalText(page, '#required-kw', '10.8');
    await equalText(page, '#running-kw', '6.4 kW');
    await equalText(page, '#starting-kw', '3.0 kW');
    await equalText(page, '#continuous-kw', '7.4 kW');
    await equalText(page, '#save-status', 'Your plan stays on this device');
    assert.equal(await page.locator('.load-row').count(), 4);
    assert.equal(await page.locator('#download').isDisabled(), false);
  });

  await check('headroom changes estimates and saves the actual draft', async () => {
    await page.selectOption('#headroom', '0.25');
    await equalText(page, '#required-kw', '11.8');
    await equalText(page, '#continuous-kw', '8.0 kW');
    await equalText(page, '#formula', '(6,400 + 3,000) × 1.25 = 11,750 W');
    await saved(page);
    assert.equal((await readSaved(page)).plan.headroom, 0.25);
  });

  await check('blank plans disable exports, and Undo restores the complete prior plan', async () => {
    await page.click('#blank-plan');
    assert.equal(await page.locator('.load-row').count(), 1);
    await exportDisabled(page);
    assert.equal(await page.locator('.load-name').getAttribute('aria-invalid'), 'true');
    await page.click('#undo');
    await equalText(page, '#required-kw', '11.8');
    assert.equal(await page.locator('.load-row').count(), 4);
    assert.equal(await page.locator('#headroom').inputValue(), '0.25');
    assert.equal(await page.locator('#undo').isVisible(), false);
    await saved(page);
  });

  await check('edited rows recalculate live and persist into a new tab', async () => {
    await page.click('#blank-plan');
    await page.locator('.load-name').fill('Workshop lights');
    await page.locator('.load-running').fill('1000');
    await page.locator('.load-starting').fill('0');
    await equalText(page, '#required-kw', '1.1');
    await equalText(page, '#starting-kw', '0.0 kW');
    await saved(page);
    const second = await loadPage(extensionURL);
    assert.equal(await second.locator('.load-name').inputValue(), 'Workshop lights');
    assert.equal(await second.locator('.load-starting').inputValue(), '0');
    await equalText(second, '#required-kw', '1.1');
    await second.close();
  });

  await check('incomplete drafts persist without becoming a valid estimate', async () => {
    await page.locator('.load-starting').fill('');
    await exportDisabled(page);
    await saved(page);
    const second = await loadPage(extensionURL);
    assert.equal(await second.locator('.load-name').inputValue(), 'Workshop lights');
    assert.equal(await second.locator('.load-starting').inputValue(), '');
    await exportDisabled(second);
    await second.close();
  });

  await check('closing immediately after an edit preserves the last keystroke and incomplete draft', async () => {
    const closing = await loadPage(extensionURL);
    await closing.locator('.load-running').fill('3333');
    await closing.locator('.load-name').fill('Immediate close saved input');
    await closing.locator('.load-name').press('End');
    await closing.locator('.load-name').press('!');
    // Deliberately do not wait for the saved-status message before closing.
    await closing.close();
    const reopened = await loadPage(extensionURL);
    assert.equal(await reopened.locator('.load-name').inputValue(), 'Immediate close saved input!');
    assert.equal(await reopened.locator('.load-running').inputValue(), '3333');
    assert.equal(await reopened.locator('.load-starting').inputValue(), '');
    await exportDisabled(reopened);
    await reopened.close();
  });

  await check('invalid numeric inputs block estimates and exports', async () => {
    await page.locator('.load-starting').fill('0');
    for (const value of ['-1', '1.5', '1000001', '']) {
      await page.locator('.load-running').fill(value);
      await exportDisabled(page);
      assert.equal(await page.locator('.load-running').getAttribute('aria-invalid'), 'true');
    }
    await page.locator('.load-running').fill('0');
    await exportDisabled(page);
    await page.locator('.load-running').fill('1000');
    await equalText(page, '#required-kw', '1.1');
    await page.locator('.load-name').fill('   ');
    await exportDisabled(page);
    await page.locator('.load-name').fill('Workshop lights');
    assert.equal(await page.locator('.remove-load').getAttribute('aria-label'), 'Remove Workshop lights');
    await saved(page);
  });

  await check('HTML in names stays text through save, restore, and export', async () => {
    const name = '<img src=x onerror=alert(1)> & "lights"';
    await page.locator('.load-name').fill(name);
    await saved(page);
    const second = await loadPage(extensionURL);
    assert.equal(await second.locator('.load-name').inputValue(), name);
    assert.equal(await second.locator('#loads img, #loads script').count(), 0);
    assert.match(await second.locator('#print-summary').textContent(), /<img src=x onerror=alert\(1\)>/);
    await second.close();
  });

  await check('CSV download contains the verified load and calculation', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('#download');
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'generator-load-worksheet.csv');
    const csv = await readFile(await download.path(), 'utf8');
    assert.match(csv, /"<img src=x onerror=alert\(1\)> & ""lights""","1000","0"/);
    assert.match(csv, /"Starting event \+ headroom","1150","W"/);
    assert.match(csv, /"Assumption"/);
    assert.match(csv, /"Planning limitation"/);
    await equalText(page, '#export-status', 'Worksheet downloaded. Share it with your installer.');
  });

  await check('adding and removing rows updates the load count and largest start event', async () => {
    await page.click('#add-load');
    await equalText(page, '#load-count', '2 loads');
    await exportDisabled(page);
    const row = page.locator('.load-row').nth(1);
    await row.locator('.load-name').fill('Pump');
    await row.locator('.load-running').fill('500');
    await row.locator('.load-starting').fill('2000');
    await equalText(page, '#required-kw', '4.0');
    await equalText(page, '#running-kw', '1.5 kW');
    await equalText(page, '#starting-kw', '2.0 kW');
    await row.locator('.remove-load').click();
    await equalText(page, '#load-count', '1 load');
    await equalText(page, '#required-kw', '1.1');
    await saved(page);
  });

  await check('full-tab action carries saved inputs into a full-page extension', async () => {
    const fullPagePromise = context.waitForEvent('page');
    await page.click('#open-tab');
    const fullPage = await fullPagePromise;
    await fullPage.waitForURL(`${extensionURL}?view=tab`);
    await equalText(fullPage, '#save-status', 'Plan restored from this device');
    assert.equal(await fullPage.locator('body').evaluate(body => body.classList.contains('fullpage')), true);
    assert.equal(await fullPage.locator('#open-tab').isVisible(), false);
    await equalText(fullPage, '#required-kw', '1.1');
    await fullPage.close();
  });

  await check('print from the popup opens a populated full tab and invokes native printing', async () => {
    const printPagePromise = context.waitForEvent('page');
    await page.click('#print');
    const printPage = await printPagePromise;
    await printPage.waitForURL(`${extensionURL}?view=tab&print=1`);
    await printPage.waitForFunction(() => window.__printInvocations === 1);
    assert.match(await printPage.locator('#print-summary').textContent(), /1,150 W/);
    await printPage.emulateMedia({ media: 'print' });
    assert.equal(await printPage.locator('.app-shell').isVisible(), false);
    assert.equal(await printPage.locator('#print-worksheet').isVisible(), true);
    assert.equal(await printPage.locator('#print-summary').isVisible(), true);
    const pdf = await printPage.pdf({ path: resolve(profile, 'worksheet.pdf'), format: 'A4' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.byteLength > 2000, 'Print worksheet must produce a nonempty PDF');
    await printPage.emulateMedia({ media: 'screen' });
    await printPage.click('#print');
    assert.equal(await printPage.evaluate(() => window.__printInvocations), 2);
    await printPage.close();
  });

  await check('copy summary succeeds or offers the documented download fallback', async () => {
    await page.click('#copy');
    await page.waitForFunction(() => ['Summary copied.', 'Copy unavailable. Download the worksheet instead.']
      .includes(document.querySelector('#export-status').textContent));
  });

  await check('calculator restores and exports offline without external network requests', async () => {
    await context.setOffline(true);
    const offline = await loadPage(`${extensionURL}?view=tab`);
    await equalText(offline, '#required-kw', '1.1');
    await offline.selectOption('#headroom', '0.2');
    await equalText(offline, '#required-kw', '1.2');
    await saved(offline);
    const downloadPromise = offline.waitForEvent('download');
    await offline.click('#download');
    const download = await downloadPromise;
    assert.match(await readFile(await download.path(), 'utf8'), /"Starting event \+ headroom","1200","W"/);
    await offline.close();
    await context.setOffline(false);
    assert.deepEqual(externalRequests, [], 'Calculator must not send load data or fetch external resources');
  });

  await check('deleting the saved plan clears real Chrome storage, and Undo restores it', async () => {
    await page.click('#delete-plan');
    await equalText(page, '#save-status', 'Saved plan deleted');
    assert.equal(await readSaved(page), undefined);
    await exportDisabled(page);
    const fresh = await loadPage(extensionURL, { restored: false });
    await equalText(fresh, '#save-status', 'Your plan stays on this device');
    await equalText(fresh, '#required-kw', '10.8');
    await fresh.close();
    await page.click('#undo');
    await equalText(page, '#required-kw', '1.1');
    await saved(page);
    assert.equal((await readSaved(page)).plan.loads[0].runningWatts, '1000');
  });

  await check('privacy link opens the packaged policy without external requests', async () => {
    const policyPromise = context.waitForEvent('page');
    await page.locator('a[href="privacy.html"]').click();
    const policy = await policyPromise;
    await policy.waitForURL(`chrome-extension://${installed.id}/privacy.html`);
    await equalText(policy, 'h1', 'Generator Size Calculator privacy policy');
    assert.match(await policy.locator('main').textContent(), /chrome\.storage\.local/);
    await policy.close();
    assert.deepEqual(externalRequests, []);
  });

  await check('extension has no browser errors', async () => {
    assert.deepEqual(failures, []);
  });
  console.log(`\n${completed} browser checks passed against the loaded Manifest V3 extension.`);
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
