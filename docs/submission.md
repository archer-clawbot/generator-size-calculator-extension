# Publish to the Chrome Web Store and GitHub

Prepared September 30, 2026 for version 1.0.0. This is a submission guide; an included package or source archive is not evidence that Google or GitHub publication has occurred.

## Before submitting

1. Install the exact packaged extension in desktop Chrome and complete the reviewer checks in [store-listing.md](store-listing.md).
2. Run `npm test`, `npm run check`, and `npm run package` from the repository root. Use the resulting `dist/generator-size-calculator-1.0.0.zip` for the store.
3. Confirm `manifest.json` sits at the ZIP root, with no outer folder. Check the version, title, description, icons, and sole `storage` permission. Later uploads require an increased manifest version. [Chrome preparation guide](https://developer.chrome.com/docs/webstore/prepare)
4. Publish [privacy-policy.html](privacy-policy.html) at an accessible HTTPS website URL under the owner's control. Open the live URL without signing in and verify the policy text. A proposed path is not a published policy; enter only the verified live URL in the store form.
5. Use an existing publisher support address or a confirmed support page. Do not invent an email address or a future GitHub URL.

Local storage is still user-data handling under Chrome policy, so the public policy and accurate data disclosures are required. [Official User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

## Required artwork

| Asset | Required dimensions and format | Included file |
| --- | --- | --- |
| Extension/store icon | 128 × 128 PNG, packaged in the ZIP; Google recommends approximately 96 × 96 visible artwork with transparent padding for a square icon | `extension/icons/icon128.png` |
| Screenshot | At least 1, up to 5; 1280 × 800 or 640 × 400; square corners, full bleed | `docs/images/calculator-1280x800.png` |
| Additional screenshot | Same requirements | `docs/images/calculator-popup-1280x800.png` |
| Small promotional tile | Required, 440 × 280; PNG or JPEG | `docs/images/promo-440x280.png` |
| Marquee promotional image | Optional, 1400 × 560 | Not required for this submission |

The 16, 32, and 48 pixel icons are also included for Chrome's interface. Use actual extension screenshots that match version 1.0.0, and check readability at the store's smaller display size. [Official image requirements](https://developer.chrome.com/docs/webstore/images), [listing asset fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

## Developer account

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) with the Google account that will own the extension. Register, accept Google's developer agreement/policies, and pay the one-time fee shown in the registration flow. [Official registration guide](https://developer.chrome.com/docs/webstore/register)
2. Set the publisher name and verify the contact email. Monitor that email for review decisions. [Official account setup](https://developer.chrome.com/docs/webstore/set-up-account)
3. Enable Google Account 2-Step Verification before publishing or updating extensions. [Official publishing prerequisites](https://developer.chrome.com/docs/webstore/using-api)
4. Complete the dashboard's Trader/Non-Trader declaration and any verification requested. All developers must declare their status; the owner must make that determination. Trader verification requests legal name, phone, and address, which are displayed publicly on the item listing. [Official Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)

## Upload and review

1. In the dashboard, choose **Add new item**, select `dist/generator-size-calculator-1.0.0.zip`, and upload it.
2. Fill the **Store listing** tab with [the prepared copy](store-listing.md) and the artwork above. Set a suitable current category and English language.
3. Complete **Privacy practices** using the single purpose, `storage` justification, remote-code answer, local-input disclosure, and verified public privacy policy URL in that document. Review the current category descriptions before certifying the answers.
4. Choose the desired countries and visibility in **Distribution**. Public makes it discoverable; unlisted provides access by the listing link; private testing can be used before launch.
5. Put the supplied reviewer checks in **Test instructions**. State that no login or credentials are needed.
6. Choose **Submit for Review**. If you want to review the approved listing before launch, use deferred publishing. Google documents a 30-day window to publish an approved staged item before it returns to draft.
7. Watch the dashboard and contact email for approval or requested changes. Google's review duration varies. Record the assigned extension ID and real store URL only after the item exists. [Official upload and publishing process](https://developer.chrome.com/docs/webstore/publish)

## Avoid preventable review issues

- Provide a working public policy URL and ensure it matches local autosave, copy, export, print, and external-link behavior.
- Declare locally handled form data; saying there is no user data because there is no server is inaccurate.
- Keep the single purpose and permission explanations narrow. Do not add broad page access for this calculator.
- Keep executable code packaged; no CDN scripts, remote JavaScript, or obfuscated functionality.
- Submit a working calculator with useful offline functionality, rather than a shortcut whose sole function is opening the original website.
- Keep claims and images faithful to the released extension; do not promise a guaranteed generator fit or electrical design approval.

These points reflect Google's [privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) and [program policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

## Publish the source on GitHub

Suggested repository name: `generator-size-calculator-extension`. Suggested description: `Offline Chrome generator sizing calculator from Backup Generator Guide. Editable loads, local autosave, CSV export, and print.`

1. Choose the owner account or organization and create a public repository. This source already includes a README, MIT license, and privacy policy, so use an empty repository when pushing existing code. [GitHub repository guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
2. Upload or push the contents of this project, including `extension/`, tests, documentation, and package scripts. Keep browser profiles, generated dependencies, credentials, and unrelated workspace files out of the repository. [GitHub upload guide](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
3. Add the original calculator URL as the repository website. Enable Issues if it will be the extension's support channel.
4. Create a `v1.0.0` release and attach the installable extension ZIP. The source ZIP may also be attached for convenience. The ZIP must be extracted and loaded unpacked for manual Chrome testing; GitHub distribution does not itself install or list the extension in Chrome. [GitHub release guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
5. When the store listing is live, add its verified link to the README. Update the store support URL to the real repository Issues URL if that is the chosen support channel.

Do not label a release as Chrome Web Store approved until the dashboard confirms approval. Keep version numbers and listing claims aligned when publishing updates.
