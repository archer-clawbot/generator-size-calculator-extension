import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export async function check() {
  const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert(manifest.name.length <= 75);
  assert(manifest.description.length <= 132);
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const field of ['host_permissions','optional_host_permissions','content_scripts','background','web_accessible_resources','externally_connectable']) assert(!manifest[field], `Unexpected ${field}`);
  assert(manifest.content_security_policy.extension_pages.includes("connect-src 'none'"));
  assert(!/unsafe-eval|unsafe-inline|https:/.test(manifest.content_security_policy.extension_pages));
  const required = ['index.html','app.js','calculator.js','styles.css','privacy.html'];
  for (const file of required) assert((await stat(join('extension', file))).isFile(), `Missing ${file}`);
  for (const [size, path] of Object.entries(manifest.icons)) {
    const png = await readFile(join('extension', path));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
  const walk = async dir => {
    for (const file of await readdir(dir, { withFileTypes:true })) {
      const path = join(dir, file.name);
      if (file.isDirectory()) { await walk(path); continue; }
      if (file.name.endsWith('.js')) {
        execFileSync(process.execPath, ['--check', path]);
        const js = await readFile(path, 'utf8');
        assert(!/\b(?:eval|fetch|XMLHttpRequest|WebSocket)\s*\(|new\s+Function\b|\.innerHTML\s*=/.test(js), `Unsafe or remote execution in ${path}`);
      }
      if (file.name.endsWith('.html')) {
        const html = await readFile(path, 'utf8');
        assert(!/<style\b/i.test(html), `Inline CSS in ${path}`);
        assert(!/\son\w+\s*=|<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `Inline JavaScript in ${path}`);
        assert(!/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']https?:/i.test(html), `Remote resource in ${path}`);
      }
    }
  };
  await walk('extension');
  for (const [file,width,height] of [['promo-440x280.png',440,280],['calculator-1280x800.png',1280,800],['calculator-popup-1280x800.png',1280,800]]) {
    const png = await readFile(join('docs/images',file));
    assert.equal(png.readUInt32BE(16),width);
    assert.equal(png.readUInt32BE(20),height);
  }
  console.log('Manifest, local-only code, syntax, icons, privacy page, and store image dimensions passed.');
}
if (process.argv[1]?.endsWith('/check.mjs') || process.argv[1]?.endsWith('\\check.mjs')) await check();
