# Version 1.0.0 verification

Verified September 30, 2026.

- 15 calculation and export tests passed, including the website example, separate continuous demand, single largest extra start, input bounds, blank-value rejection, and CSV formula protection.
- 17 browser checks passed in the actual loaded Manifest V3 extension, using Chromium supplied by Playwright 1.62.1. They cover local storage, the last keystroke before closing, incomplete drafts, invalid inputs, exports, full-tab view, privacy, printing/PDF, offline operation, and Delete/Undo.
- Browser checks observed zero external requests and zero runtime or console errors. The native print dialog was stubbed for navigation checks; print styling and a real generated PDF were also checked.
- Manifest, packaged local-only resources, JavaScript syntax, privacy page, PNG icon sizes, and store image dimensions passed.
- The upload ZIP was opened with an independent ZIP reader, all entry checksums passed, and `manifest.json` was verified at the root without an outer directory.
- Both store screenshots were captured from the installed extension. The compact view screenshot was resized to the store dimensions without overlays.

Run `npm ci`, `npm test`, `npm run check`, and `npm run package`. For browser verification, first run `npx playwright install chromium`, then `npm run test:browser`. `EXTENSION_PATH` can point the browser check at an extracted release ZIP.

Chrome Web Store review is separate from these checks. Passing checks does not mean Google has approved or listed the extension.
