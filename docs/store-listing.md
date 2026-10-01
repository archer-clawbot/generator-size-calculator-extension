# Chrome Web Store listing copy

Prepared September 30, 2026 for version 1.0.0. The store title and short description come from `extension/manifest.json`; keep this document and that manifest consistent before packaging.

## Name

Generator Size Calculator — Backup Generator Guide

## Short description

Estimate generator power from running watts, motor-starting loads and headroom. Save locally, export a worksheet, and work offline.

131 characters, within Chrome's 132-character limit.

## Detailed description

Plan the appliance loads you want to power during an outage with Generator Size Calculator from Backup Generator Guide.

Open the calculator from Chrome's toolbar or use the full-tab view for a larger workspace. It runs offline, so your planning tool remains available without an internet connection.

WHAT YOU CAN DO

• Start with an example plan or a blank plan.
• Add, edit, or remove appliances and enter running watts and extra starting watts.
• Include the loads you intend to power together and choose a headroom percentage.
• Review continuous power and a starting-event capacity estimate.
• Keep one automatically saved local draft, including unfinished entries.
• Copy a summary, export your plan as CSV, or print it.
• Delete your saved plan when you are finished.

YOUR PLAN STAYS ON YOUR DEVICE

The extension stores your calculator inputs in the current Chrome profile using local extension storage. Backup Generator Guide does not receive your plan. There are no accounts, analytics, advertising trackers, or remote calculator scripts. The extension does not read other websites or your browsing history. Copy, export, print, and website links run only when you choose them.

USE REAL APPLIANCE RATINGS

Example wattages are placeholders. Replace them with appliance labels or manufacturer specifications. Extra starting watts means demand above normal running watts. The estimate assumes all listed loads run together and only one motor starts at a time. The default 15% headroom is a planning assumption. This calculator does not assess wiring, voltage compatibility, transfer equipment, installation, or every generator's motor-starting capability. Confirm the final generator choice with product documentation and a qualified installer.

Created by Backup Generator Guide.
https://backupgeneratorguide.com/

## Suggested store fields

| Field | Value |
| --- | --- |
| Language | English (United States) |
| Category | Choose the current category for a calculator or utility in the dashboard |
| Website | `https://backupgeneratorguide.com/tools/generator-size-calculator/` |
| Support URL | Use the actual published GitHub issue page once the repository exists, or the owner's confirmed support page |
| Privacy policy URL | **Pending publication.** Host `docs/privacy-policy.html`, verify the live public page, then enter that verified URL |

Do not enter a local file path, an unconfirmed repository URL, or an invented privacy URL in the store form.

## Single purpose description

Help users estimate generator continuous and single-motor starting-event capacity from an editable appliance load plan, with headroom, a local saved draft, and copy, export, and print tools for that plan.

## Permission justification: storage

The storage permission saves and restores one user-created calculator draft in chrome.storage.local. The saved information consists of appliance names, running watts, extra starting watts, and headroom, including incomplete entries. It is used only to reopen the user's plan in the toolbar popup and full-tab calculator. It is not sent to the developer or third parties and is not synchronized using Chrome sync storage. The user can delete the saved plan.

There are no host permissions or additional permission justifications for version 1.0.0.

## Remote code declaration

Select **No, I am not using remote code.** All HTML, CSS, JavaScript, and calculator assets are packaged with the extension. Website links do not download or execute code inside the extension.

## Data-use disclosure

Treat locally processed or saved inputs as handled user data. Chrome's policy applies even when data never leaves the device.

For version 1.0.0, the extension handles user-entered calculator form content: load names and electrical planning values. Select **Website content** where the dashboard's category includes form text or user-generated content. Explain that this is input entered directly into the calculator and stored locally, rather than content read from other websites. If the current dashboard exposes a separate category for user-provided form content, select that matching category instead. This classification is an interpretation of the dashboard taxonomy; the disclosed data flow is definite.

Leave these categories unselected because the extension does not request, read, or derive them: personally identifiable information, health information, financial/payment information, authentication information, personal communications, location, web history, and user activity such as network monitoring or interaction tracking. Ordinary calculator interactions are not recorded as analytics.

Confirm the actual released code, policy, and current dashboard wording agree before certifying. The publisher can certify that:

- Data is not sold or transferred to third parties outside permitted use cases.
- Data is not used or transferred for purposes unrelated to the extension's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending purposes.

Do not replace these disclosures with a blanket claim that the extension handles no user data.

## Reviewer test instructions

No credentials or account are required.

1. Open the toolbar popup and load the example plan.
2. Edit a load's running watts and extra starting watts, then change headroom.
3. Verify that totals update and invalid or unfinished values are identified.
4. Close and reopen the popup; the draft should remain.
5. Open the full-tab calculator; it should show the same saved plan.
6. Add a load, copy the summary, export CSV, and preview Print.
7. Use Delete saved plan and confirm the saved draft is removed.
8. Disconnect from the internet and repeat a calculation. Calculator functionality should remain available.

## Official references

- [Manifest description and packaging](https://developer.chrome.com/docs/webstore/prepare)
- [Privacy fields, permissions, remote code, and certifications](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data FAQ: local processing and storage still require disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
