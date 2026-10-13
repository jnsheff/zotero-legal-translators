# Zotero translators for Westlaw and Lexis+

Zotero web translators (for the Zotero Connector) that save legal sources from Westlaw and Lexis+ (and two free sites):

| Translator | Sites | Saves |
|---|---|---|
| `Westlaw (legal).js` | `*.westlaw.com` (Westlaw Edge / Precision) | cases, statutes and regulations, law-review articles; search-result lists |
| `Cornell LII (legal).js` | `law.cornell.edu` | the primary sources: U.S. Code, CFR, Supreme Court opinions, the Constitution, the federal rules, the UCC and state regulations |
| `Lexis+ (legal).js` | `plus.lexis.com`, `advance.lexis.com` | the same |
| `Federal Register (legal).js` | `www.federalregister.gov` | rules, proposed rules, notices and presidential documents, as statutes filed under `Fed. Reg.` |
| `Bloomberg Law (legal).js` | `www.bloomberglaw.com` | court papers from a docket (complaints, motions, orders), as cases named for the paper |

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
* **Westlaw law-review articles** are read from the header (`#title`, `#author`, `#pubname`, `#cite`) and the first
  line of the text, which gives the Bluebook journal abbreviation and the month and year.
* **Lexis cases** are read from `h1#SS_DocumentTitle`, `span.active-reporter`, `span.date` and the `p.SS_DocumentInfo`
  lines (full court name, date, docket), checked against a saved page. Federal code cites (USC, USCA, USCS) are
  normalised to `U.S.C.`, as the Bluebook wants.
* Courts are converted to Bluebook abbreviations where recognised (`5th Cir.`, `E.D. Tex.`, `S.D.N.Y.`, `U.S.`);
  state codes become e.g. `N.Y. Civ. Rights Law`. Others are kept as the site prints them.

* **Treatises** (Westlaw and Lexis+) become Book Sections: Title = section title, Book Title = the treatise,
  Volume, and the section number in Extra as `Section: 18:2` (Zotero has no section field for book sections); Westlaw also gives
  Edition, Date (the update month) and the treatise author as Book Author.
* **Case jurisdiction and filing date** (all three translators) go into citation-phoenix's Extra block, `mlzsync1:{"extrafields":{...}}`,
  where its code and styles read them: `jurisdiction` as a key with its names ("005us:c2United States|US|Second Circuit") and `filingDate`
  (citation-phoenix's styles read it as the "submitted" date; as a plain field it would only be a stray `filingDate:` line in Extra). The
  jurisdiction follows citation-phoenix's court mapper rule for rule (`src/shared.js`, `jurisPhoenixFederal` and `jurisPhoenixState`) with
  one repair (a state is found longest name first, so West Virginia is not Virginia) and these additions for what it misses: Lexis's
  "for the" wording, Bluebook "2d Cir." / "3d Cir.", district and bankruptcy courts ("S.D.N.Y.", "United States District Court for the
  Eastern District of Texas"), and state-court abbreviations ("Tex.", "N.Y. App. Div."). A court it cannot place leaves no jurisdiction
  (citation-phoenix then fills in `us`). The Court field stays the Bluebook abbreviation.
* **Westlaw cases** also save the passages you highlighted on Westlaw as a note tagged `note` (each as `<blockquote>text [page]</blockquote>`,
  the page being the star page where the highlight starts; "**" parallel pagination is skipped), and the URL is a link that finds the case
  by its citation (`…Results.html?query=find:499 U.S. 340#autoLogin`, as citation-phoenix does), which works for anyone with Westlaw
  access; a case with no reporter citation keeps its document address.
* **Restatements** (Westlaw and Lexis+; also the Model Penal Code, as Westlaw's Uniform Laws Annotated prints it) become Books marked as citation-phoenix's *restatement* type (`mlzsync1:{"xtype":"restatement"}`
  in Extra), so the hicite exporter writes them as model codes ("Restatement (Second) of Torts § 402A (Am. L. Inst. 1965)"). The item is the
  work, not the section: Title without the section ("Restatement (Second) of Torts"; Westlaw's full title, "Restatement (Third) of Torts:
  Liability for Physical and Emotional Harm", is read from the breadcrumb because its citation line abbreviates it), the American Law
  Institute as Author and Publisher, the Date (the year), a draft's name in Edition ("Tentative Draft No. 2"), and the section with its
  heading in a note. Lexis+ titles such as `Restat 2d of Torts, § 552A` are normalized, and the year comes from the closing
  "Copyright (c) 1977, The American Law Institute" line. Without citation-phoenix the marker in Extra is inert. The Model Penal Code page gives no year (its footer says "Current through 2025 Annual Meeting"), so Date is left blank (hicite then prints "n.d."); add the year of the official text by hand.
* **Journal-article authors** on Lexis are read from the "Author:" line, including joint authors separated by commas and footnote marks
  ("A,* B,** & C***"); Westlaw's "A , B , C" is split too. Lexis category prefixes ("ARTICLE:", "RESPONSE:") are dropped from titles.
* **Regulations** (C.F.R., Federal Register, state codes such as NYCRR) are statutes with that code. The title is the section heading (Lexis: the
  `h2.SS_Banner`). `dateEnacted` is an effective date, never "current through": Westlaw's `#effectiveDate` (the last date of a range); on Lexis
  the latest of the Federal Register notices in History, the dates in an Effective Date Note, and a state History line's "effective 06/01/26".
  With none, it is left blank. A Westlaw Federal Register document ("86 FR 61402") is a statute with code `Fed. Reg.`, volume and page.
  Westlaw federal-code items (U.S.C., C.F.R., NYCRR, Stat., Fed. Reg.) get a find link, as cases do.
* **Codified statutes**: Westlaw state codes that are one general compilation are named from a table (`GENERAL_CODES`: "N.C. Gen. Stat.",
  "Mass. Gen. Laws" with the chapter in Code Number); a code named by subject keeps the subject ("N.Y. Civ. Rights Law"). Lexis "NY CLS" codes are
  named from the page heading. A Lexis statute's date is the latest effective date in its History, else the latest date there.
* **Session laws** (Westlaw "Historical Session Laws", Lexis acts) are statutes with code `Stat.`, volume in Code Number, first page in Section,
  Public Law Number and Session; hicite exports them as `statsess`.
* **Lexis treatises**: a title with a section sign ("2 Nimmer on Copyright § 8.02") is a treatise, not a code, when the Info pane says "Find
  references to this treatise". The authors, publisher and date come from the Source Information dialog, which the translator opens by clicking
  the link under "Source Information" (it is read directly if the page was saved with it open); without it the publisher and year come from the
  closing "Copyright 2026, Matthew Bender & Company, Inc." line and there is no author. The click has not been tried on a live page.
* **Dates** are written with the month spelled out ("October 1, 2026").

Not handled: dockets and filings, secondary sources other than law-review articles, treatises and restatements, Lexis and Westlaw pages
for states whose code needs a title number (Delaware, Illinois, Louisiana, Maine, Maryland, Oklahoma, Pennsylvania, Vermont).
(Restatements are saved from document pages, not from search results.)

### Federal Register

A document page (`/documents/YYYY/MM/DD/<number>/<slug>`) becomes a Statute marked as citation-phoenix's *regulation* type (`mlzsync1:{"xtype":"regulation"}` on the first line of Extra; citation-phoenix reads it as the regulation type, and without the add-on it is an ordinary Statute) and filed under `Fed. Reg.`, as the Westlaw translator saves a Federal Register document: Name of Act = the
title, Code Number = the volume and Section = the first page (from "90 FR 40975"), Pages = "40975-40985", Date Enacted = the publication date (the date a
Bluebook cite gives), Abstract = the summary, URL = the canonical address. The Document Details and Dates boxes follow in Extra, one `Label: value` per line:
Document Type, Agency, CFR, Effective Date (also Comments Close / Open), Document Number, RIN and the Docket ID (from the regulations.gov box). The PDF of the
printed version (the "View printed version (PDF)" link, on govinfo.gov) is the attachment, titled "Snapshot"; a page without one saves the page itself.
hicite exports the item as a government document (`90 Fed. Reg. 40975 (Aug. 22, 2025)`). Search-result pages are not handled. The fixture
`fixtures/federalregister-rule.html` is trimmed from the page for 2025-16129; the site refuses scripted downloads, so the page has to be saved from a browser.

### Bloomberg Law

A docket document page (`/product/blaw/document/X…` whose title reads "JOSHI v OPENAI FOUNDATION et al, Docket No. 4:26-cv-00222 (N.D. Fla. May 10, 2026), Court Docket")
is saved as a Case named for the paper and the case, the way the library files court papers and hicite cites them (`\defcasedoc`): Case Name
"Complaint: Joshi v. OpenAI Foundation", Court `N.D. Fla.`, Docket Number, Date Decided = the date the document was filed, and, in Extra, citation-phoenix's
block (jurisdiction and filing date, as for the other cases) followed by Docket Entry, Case Number (with the judges' initials), and Pages. The viewer draws the PDF
with PDF.js, so the page holds its first-page text: the paper's title ("COMPLAINT"), the footer ("Case 4:26-cv-00222-MW-MJF / Document 1 / Filed 05/10/26 / Page 1 of 76"),
and the spelling of the party names ("OpenAI", which the title prints as "OPENAI"). For a part after the first the paper is the part's title ("Civil Cover Sheet"). Only the part showing is saved, with its PDF as the snapshot: the page gives no address for a PDF, but the viewer's "Open PDF in New Window" opens `<document address>/download?imagename=<part number>`, which is what the translator attaches (`imagename=1` for the first part, `2` for the second). Another part is saved from its own page. A part with a title other than its number ("Part 2: Civil Cover Sheet") names the paper and is recorded in Extra (`Part: 2: Civil Cover Sheet`).

### Cornell LII

Pages are plain server-rendered HTML, so these were built and tested against copies of real public pages
(`fixtures/lii-*.html`, trimmed). Statutes, regulations, rules, the Constitution and the UCC are saved as Statutes
with Bluebook-style codes: `U.S.C.`, `C.F.R.`, `Fed. R. Civ. P.` (also Evid., App., Crim., Bankr., `Sup. Ct. R.`),
`U.S. Const.` (section `art. I` / `amend. XIV`), `U.C.C.`, and state codes as LII prints them. Supreme Court
opinions become Cases with a short Bluebook name ("Roe v. Wade"; roles, "et al." and given names are dropped),
docket number and decision date; older opinions also get the U.S. Reports citation. Newer opinions carry only the
docket number, because LII pages for them give no U.S. Reports cite. The list page "Cases for 347 U.S. 483" shows
the item picker. Wex, CONAN and the Supreme Court Bulletin are not primary sources and are ignored.

All three translators attach a Snapshot of the page. Note that Westlaw and Lexis pages show your client ID and
account name, so their snapshots contain them.

## Install

**Easiest:** download `zotero-legal-translators.xpi` from the latest release and install it in Zotero (Tools >
Plugins > gear menu > Install Plugin From File). It copies the three translators into Zotero's translators folder
at every start (replacing older copies) and removes them if you uninstall the plugin. Restart Firefox afterwards,
because the connector keeps its own cache of translators. (Automatic updates need the repository to be public.)

**By hand:** copy the `.js` files from `translators/` into the `translators` folder of your Zotero data directory
(Zotero > Settings > Advanced > Files and Folders > Show Data Directory), then restart Zotero. Priority 90 makes them
run before Zotero's built-in Lexis+ translator for the same site.

## Develop

`src/shared.js` (citation parsing) is spliced into `src/westlaw.js` and `src/lexis.js` by `python3 build.py`, which
writes `translators/`. Edit `src/`, not `translators/`. `sh test/run-all.sh` checks the build is current, runs the
parser tests (macOS `jsc`) and runs both translators against the fixtures in headless Chrome.

The repository is MIT-licensed; the three translators carry Zotero's AGPL-3.0 header so they can be submitted to
the Zotero translators repository (the translators were written for that and pass its linter; the Cornell LII
translator also passes its tests, which run against the live site in `tests/`).

## Releasing

`make xpi` builds the translators and the package; `python3 tools/make-updates.py` adds it to `updates.json`
(commit that), then attach exactly that `.xpi` to the GitHub release `vX.Y.Z`.
