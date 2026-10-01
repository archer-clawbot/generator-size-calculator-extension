import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const extensionPath = resolve('extension');
const profile = await mkdtemp(resolve(tmpdir(),'generator-screenshots-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, { channel:'chromium', headless:true, viewport:{width:1280,height:800},deviceScaleFactor:1,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`] });
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  const extensions = await manager.evaluate(() => new Promise(resolveInfo => chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true},resolveInfo)));
  const installed = extensions.find(info=>info.name==='Generator Size Calculator — Backup Generator Guide');
  assert(installed,'Extension must load for real screenshots.');
  const page = await context.newPage();
  await page.goto(`chrome-extension://${installed.id}/index.html?view=tab`);
  await page.waitForFunction(()=>document.querySelectorAll('.load-row').length===4 && !document.querySelector('#download').disabled);
  await page.screenshot({path:'docs/images/calculator-1280x800.png'});
  // At the native compact view's aspect ratio, upscale the actual screenshot
  // to the required store resolution without adding banners or mock browser UI.
  await page.setViewportSize({width:800,height:500});
  await page.goto(`chrome-extension://${installed.id}/index.html`);
  await page.waitForFunction(()=>document.querySelectorAll('.load-row').length===4 && !document.querySelector('#download').disabled);
  // A second full-bleed screenshot shows the genuine compact toolbar view.
  await sharp(await page.screenshot()).resize(1280,800).png().toFile('docs/images/calculator-popup-1280x800.png');
  console.log('Captured two 1280 × 800 screenshots from the installed extension.');
} finally { await context?.close(); await rm(profile,{recursive:true,force:true}); }
