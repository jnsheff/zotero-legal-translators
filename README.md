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

## Status

Checked against saved pages (Westlaw Advantage case, statute and search-results pages; a Lexis+ statute page and
a results page), not yet against a live session. Those pages are not in the repository (copyrighted, and they
carry account details); `test/harness.html` runs the translators on them when they are in `test pages/`, and
otherwise on the synthetic fixtures in `fixtures/`, whose markup copies the real element ids.

* **Westlaw** reads the header (`#title`, `#courtline`, `#filedate`, `#cite0`; `#cite`, `#codeSetName`,
  `#titleDesc` for statutes) and the docket number from the document text. Results pages give one item per case or
  code hit (briefs, practice materials and secondary sources are skipped).
* **Lexis+** reads `h1#SS_DocumentTitle` and the reporter/info elements; statutes take the code and section from
  the title and the section name from the heading in the text. The results page is read from `a.titleLink`; items
  that are not cases, statutes or articles (news, agency decisions) are skipped.
* **Not yet checked:** a Lexis case page and a Westlaw law-review page (no saved sample), so those rely on the
  generic citation parser.
* Courts are converted to Bluebook abbreviations where recognised (`5th Cir.`, `E.D. Tex.`, `S.D.N.Y.`, `U.S.`);
  state codes become e.g. `N.Y. Civ. Rights Law`. Others are kept as the site prints them.

Not handled: Lexis session laws and acts without a section number, secondary sources other than law-review
articles, dockets and filings.

## Install

Copy the two `.js` files from `translators/` into Zotero's `translators` directory (Zotero > Settings >
Advanced > Files and Folders > Show Data Directory > `translators`), then restart Zotero. Priority 90 makes them
run before Zotero's built-in Lexis+ translator for the same site.

## Develop

`src/shared.js` (citation parsing) is spliced into `src/westlaw.js` and `src/lexis.js` by `python3 build.py`, which
writes `translators/`. Edit `src/`, not `translators/`. `sh test/run-all.sh` checks the build is current, runs the
parser tests (macOS `jsc`) and runs both translators against the fixtures in headless Chrome.

MIT license.
