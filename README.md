# Zotero translators for Westlaw and Lexis+

Two Zotero web translators (for the Zotero Connector) that save legal sources from Westlaw and Lexis+:

| Translator | Sites | Saves |
|---|---|---|
| `Westlaw (legal).js` | `*.westlaw.com` (Westlaw Edge / Precision) | cases, statutes and regulations, law-review articles; search-result lists |
| `Lexis+ (legal).js` | `plus.lexis.com`, `advance.lexis.com` | the same |

Cases fill Case Name, Reporter, Volume, First Page, Court, Date Decided, Docket Number (`WL` and `U.S. Dist. LEXIS`
cites are handled: volume = year, page = document number). Statutes fill Code, Code Number, Section, Name of Act and
Public Law Number where present; regulations (`17 C.F.R. § 240.10b-5`) are statutes with that code. Law-review
citations become Journal Articles. Westlaw items keep the document URL (without the session query string); Lexis
sessions links are not saved. All-capitals case names are converted to title case.

## Status: not yet tried on the real sites

I had no Westlaw or Lexis access while writing these. The approach is built to survive that:

* The **citation is parsed from the page title and the citation line** with a Bluebook-aware parser
  (`src/shared.js`, tested on many citation forms). That does not depend on the sites' markup.
* Page elements only **supplement** it (court, decision date, docket). The Lexis selectors marked `(*)` in
  `src/lexis.js` are the ones Zotero's existing Lexis+ translator uses; the Westlaw selectors are from memory.
* The fixtures in `fixtures/` are **synthetic** (markup invented to match those selectors), not saved pages.

So expect to adjust selectors on first use. If a page is not recognised, the translator reports no icon; send me
the page's HTML (Save Page As... from the logged-in browser, with anything private removed) and the selectors can
be fitted to it. Not handled yet: Lexis session laws and acts without a section number (Zotero's own Lexis+
translator handles some of these), secondary sources other than law-review articles, dockets and filings.

## Install

Copy the two `.js` files from `translators/` into Zotero's `translators` directory (Zotero > Settings >
Advanced > Files and Folders > Show Data Directory > `translators`), then restart Zotero. Priority 90 makes them
run before Zotero's built-in Lexis+ translator for the same site.

## Develop

`src/shared.js` (citation parsing) is spliced into `src/westlaw.js` and `src/lexis.js` by `python3 build.py`, which
writes `translators/`. Edit `src/`, not `translators/`. `sh test/run-all.sh` checks the build is current, runs the
parser tests (macOS `jsc`) and runs both translators against the fixtures in headless Chrome.

MIT license.
