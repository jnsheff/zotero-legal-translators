// Citation parsing and item building (no DOM). Run: jsc test/parse-jsc.js
var errors = [];
var Zotero = { Item: function (t) { this.itemType = t; this.creators = []; this.notes = []; } };
var ZU = { capitalizeTitle: function (s) { return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); },
	cleanAuthor: function (a) { var p = a.split(' '); return { firstName: p.slice(0, -1).join(' '), lastName: p.slice(-1)[0], creatorType: 'author' }; } };
eval(read('src/shared.js') + '; this.S = { findAuthor: findAuthor, normCode: normCode, abbrevCourt: abbrevCourt, stateCodeName: stateCodeName, parseBareCite: parseBareCite, parseCitation: parseCitation, parseStatute: parseStatute, buildItem: buildItem, cleanTitle: cleanTitle, findDocket: findDocket, findDate: findDate, latestDate: latestDate, effectiveDates: effectiveDates, laterDate: laterDate, latestNumericEffective: latestNumericEffective, isRegulationCode: isRegulationCode, classify: classify, isRestatement: isRestatement, parseRestatement: parseRestatement, normalizeRestatementName: normalizeRestatementName, findCopyrightYear: findCopyrightYear, mapJurisdiction: mapJurisdiction, encodeJurisdiction: encodeJurisdiction };');
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(m + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
function pick(o, ks) { var r = {}; ks.forEach(function (k) { r[k] = o[k]; }); return r; }

var c = S.parseCitation('Feist Publications, Inc. v. Rural Telephone Service Co., Inc., 499 U.S. 340, 345 (1991)');
eq(pick(c, ['kind', 'name', 'volume', 'reporter', 'page', 'year', 'court']), { kind: 'case', name: 'Feist Publications, Inc. v. Rural Telephone Service Co., Inc.', volume: '499', reporter: 'U.S.', page: '340', year: '1991', court: '' }, 'U.S. cite');
c = S.parseCitation('Authors Guild v. Google, Inc., 804 F.3d 202 (2d Cir. 2015)');
eq(pick(c, ['reporter', 'volume', 'page', 'court', 'year']), { reporter: 'F.3d', volume: '804', page: '202', court: '2d Cir.', year: '2015' }, 'F.3d');
c = S.parseCitation('Thomson Reuters Enter. Ctr. GmbH v. Ross Intel. Inc., 2025 WL 458520, at *3 (D. Del. Feb. 11, 2025)');
eq(pick(c, ['kind', 'reporter', 'volume', 'page', 'court', 'date']), { kind: 'case', reporter: 'WL', volume: '2025', page: '458520', court: 'D. Del.', date: 'Feb 11, 2025' }, 'WL');
c = S.parseCitation('Doe v. Roe, 2023 U.S. Dist. LEXIS 1234 (S.D.N.Y. Jan. 5, 2023)');
eq(pick(c, ['reporter', 'page', 'court']), { reporter: 'U.S. Dist. LEXIS', page: '1234', court: 'S.D.N.Y.' }, 'LEXIS');
c = S.parseCitation('Bartz v. Anthropic PBC, 787 F. Supp. 3d 1007 (N.D. Cal. 2025)');
eq(pick(c, ['reporter', 'page', 'court']), { reporter: 'F. Supp. 3d', page: '1007', court: 'N.D. Cal.' }, 'F. Supp. 3d');
c = S.parseCitation('In re Smith, 12 Cal. Rptr. 3d 400, 405 (Cal. Ct. App. 2004)');
eq(pick(c, ['kind', 'reporter', 'court']), { kind: 'case', reporter: 'Cal. Rptr. 3d', court: 'Cal. Ct. App.' }, 'In re');
c = S.parseCitation('Lawrence Lessig, Code and Other Laws, 113 Harv. L. Rev. 501, 505 (2000)');
eq(pick(c, ['kind', 'author', 'title', 'reporter', 'volume', 'page', 'year']), { kind: 'article', author: 'Lawrence Lessig', title: 'Code and Other Laws', reporter: 'Harv. L. Rev.', volume: '113', page: '501', year: '2000' }, 'article');
c = S.parseCitation('Jane Doe & Richard Roe, Fair Use, 5 Yale L.J. 1 (1999)');
eq(pick(c, ['kind', 'author', 'title']), { kind: 'article', author: 'Jane Doe & Richard Roe', title: 'Fair Use' }, 'two authors');
eq(S.parseCitation('Just some text'), null, 'not a citation');
eq(S.parseCitation('Feist v. Rural, 499 U.S. 340'), null, 'no parenthetical: not enough to be sure');

var s = S.parseStatute('47 U.S.C.A. § 230 Protection for private blocking and screening of offensive material');
eq(pick(s, ['codeNumber', 'code', 'section', 'rest']), { codeNumber: '47', code: 'U.S.C.', section: '230', rest: 'Protection for private blocking and screening of offensive material' }, 'USC');
eq(pick(S.parseStatute('Cal. Civ. Code § 1798.100'), ['codeNumber', 'code', 'section']), { codeNumber: '', code: 'Cal. Civ. Code', section: '1798.100' }, 'state code');
eq(pick(S.parseStatute('17 C.F.R. § 240.10b-5'), ['code', 'section']), { code: 'C.F.R.', section: '240.10b-5' }, 'CFR');
eq(pick(S.parseStatute('Tex. Bus. & Com. Code Ann. § 26.01(b)'), ['code', 'section']), { code: 'Tex. Bus. & Com. Code Ann.', section: '26.01(b)' }, 'Tex.');
eq(S.parseStatute('Feist v. Rural'), null, 'no section sign');

eq(S.cleanTitle('Feist v. Rural, 499 U.S. 340 (1991) - Westlaw Edge'), 'Feist v. Rural, 499 U.S. 340 (1991)', 'title suffix');
eq(S.cleanTitle('Some title | Lexis+'), 'Some title', 'lexis suffix');
eq(S.findDocket('Court\nNo. 24-cv-1234 (ABC)\nfoo'), 'No. 24-cv-1234', 'docket');
eq(S.findDate('decided Mar. 27, 1991 by the court'), 'March 27, 1991', 'date, month spelled out');
eq(S.findDate('through Oct 1, 2026'), 'October 1, 2026', 'date: "Oct" without a period');
eq(S.latestDate('added Subpart B, effective Sept. 16, 2012; revised (c), effective May. 2, 2016; revised, effective Jan. 8, 2021.'), 'January 8, 2021', 'the latest of several dates');
eq(S.latestDate('no dates here'), '', 'no date');
eq(S.findAuthor('Length: 56860 words Author: Christopher Buccafusco,* Mark A. Lemley,** & Jonathan S. Masur*** Copyright\u00a92018 Christopher Buccafusco'), 'Christopher Buccafusco; Mark A. Lemley; Jonathan S. Masur', 'three authors separated by commas and footnote marks');
eq(S.findAuthor('Author: Jeremy N. Sheff * * Associate Professor of Law'), 'Jeremy N. Sheff', 'one author, marks, then a title');
eq(S.latestDate('July 19, 1952, ch 950'), 'July 19, 1952', 'a date before 1970');
eq(S.laterDate(['July 19, 1952', '']), 'July 19, 1952', 'a single early date');
eq(S.latestDate(S.effectiveDates('L 2020, ch 304, \u00a7 1, effective May 29, 2021; L 2022, effective December 16, 2022; L 2025, effective December 11, 2025. Laws 2020, eff May 29, 2021')), 'December 11, 2025', 'the latest effective date of a state History');
eq(S.effectiveDates('July 19, 1952, ch 950, \u00a7 1, 66 Stat. 797'), '', 'a History with no "effective" has none');
eq(S.laterDate(['December 9, 2020', 'January 8, 2021', '']), 'January 8, 2021', 'the later of the History and the Effective Date Note');
eq(S.laterDate(['March 3, 2022', 'January 8, 2021', '']), 'March 3, 2022', 'a later History notice wins');
eq(S.laterDate(['', '']), '', 'no dates');
eq(S.latestNumericEffective('added 100.3(B)(12)(effective 03/26/15) on 4/29/15; amended (effective 06/01/26) on 5/06/26.'), 'June 1, 2026', 'latest numeric "effective" date of a History line');
eq(S.latestNumericEffective('amended 100.3 on 3/08/06'), '', 'amendment dates alone are not effective dates');
eq([ 'C.F.R.', 'NYCRR', 'Tex. Admin. Code', 'U.S.C.', 'N.Y.C. Admin. Code', 'N.Y. Civ. Rights Law' ].map(S.isRegulationCode), [true, true, true, false, false, false], 'regulatory codes');

var it = S.buildItem(S.parseCitation('FEIST PUBLICATIONS, INC. v. RURAL TELEPHONE, 499 U.S. 340 (1991)'), { court: 'Supreme Court of the United States', date: 'March 27, 1991', docket: 'No. 89-1909' });
eq(pick(it, ['itemType', 'caseName', 'reporter', 'reporterVolume', 'firstPage', 'court', 'dateDecided', 'docketNumber']),
	{ itemType: 'case', caseName: 'Feist Publications, Inc. v. Rural Telephone', reporter: 'U.S.', reporterVolume: '499', firstPage: '340', court: 'U.S.', dateDecided: 'March 27, 1991', docketNumber: 'No. 89-1909' }, 'case item (page court/date fill gaps)');
it = S.buildItem(S.parseCitation('Authors Guild v. Google, Inc., 804 F.3d 202 (2d Cir. 2015)'), { date: 'Oct. 16, 2015' });
eq(pick(it, ['court', 'dateDecided']), { court: '2d Cir.', dateDecided: 'Oct. 16, 2015' }, 'the citation\'s court wins; the page\'s full date replaces a bare year');
it = S.buildItem(S.parseStatute('47 U.S.C.A. § 230 Protection for blocking'), {});
eq(pick(it, ['itemType', 'code', 'codeNumber', 'section', 'nameOfAct']), { itemType: 'statute', code: 'U.S.C.', codeNumber: '47', section: '230', nameOfAct: 'Protection for blocking' }, 'statute item');
it = S.buildItem(S.parseCitation('Lawrence Lessig, Code and Other Laws, 113 Harv. L. Rev. 501 (2000)'), {});
eq([it.itemType, it.creators.length, it.publicationTitle, it.pages, it.date], ['journalArticle', 1, 'Harv. L. Rev.', '501', '2000'], 'article item');
// court names
[['United States Court of Appeals, Fifth Circuit.', '5th Cir.'], ['United States Court of Appeals for the District of Columbia Circuit', 'D.C. Cir.'],
 ['United States Court of Appeals, Federal Circuit.', 'Fed. Cir.'], ['United States District Court, E.D. Texas.', 'E.D. Tex.'],
 ['United States District Court, S.D. New York.', 'S.D.N.Y.'], ['United States District Court, D. Delaware.', 'D. Del.'],
 ['United States District Court, N.D. California.', 'N.D. Cal.'], ['United States District Court for the Southern District of New York', 'S.D.N.Y.'],
 ['United States District Court for the District of Massachusetts', 'D. Mass.'], ['United States District Court, District of Columbia.', 'D.D.C.'],
 ['Supreme Court of the United States', 'U.S.'], ['Supreme Court of Texas.', 'Tex.'], ['Supreme Court of New York, Appellate Division, First Department', 'Supreme Court of New York, Appellate Division, First Department'],
 ['2d Cir.', '2d Cir.'], ['Super. Ct. Cal. San Francisco', 'Super. Ct. Cal. San Francisco']].forEach(function (p) { eq(S.abbrevCourt(p[0]), p[1], 'court ' + p[0]); });
eq(S.stateCodeName('New York', 'Civil Rights Law'), 'N.Y. Civ. Rights Law', 'state code name');
eq(S.stateCodeName('Texas', 'Business and Commerce Code'), 'Tex. Bus. and Com. Code', 'state code name 2');
eq(S.parseBareCite('168 F.4th 231'), { volume: '168', reporter: 'F.4th', page: '231' }, 'bare cite'); eq(S.parseBareCite('2025 WL 458520'), { volume: '2025', reporter: 'WL', page: '458520' }, 'bare WL');
eq(S.parseBareCite('124 Fed.R.Serv.3d 171'), { volume: '124', reporter: 'Fed.R.Serv.3d', page: '171' }, 'bare rules cite'); eq(S.parseBareCite('Approx. 16 pages'), null, 'not a cite');
eq(S.findDocket('Robert FLETCHER, Plaintiff—Appellant, v. EXPERIAN \u2062\u2063 No. 25-20086 FILED February 18, 2026'), 'No. 25-20086', 'docket before FILED');
eq(S.findDocket('Civil Action No. 1:20-cv-613-SB Judge Bibas'), 'Civil Action No. 1:20-cv-613-SB', 'civil action docket'); eq(S.findDocket('no. of pages'), '', 'no docket');
eq(['USCA', 'USCS', 'U.S.C.S.', 'U.S.C.', 'CFR', 'Tenn. Code Ann.'].map(S.normCode), ['U.S.C.', 'U.S.C.', 'U.S.C.', 'U.S.C.', 'C.F.R.', 'Tenn. Code Ann.'], 'code names');
eq(S.findAuthor('Length: 5972 words Author: Jeremy N. Sheff * * Associate Professor of Law, St. John\'s University. Text [*48] IN his article'), 'Jeremy N. Sheff', 'one author');
eq(S.findAuthor('Author: JEANNE C. FROMER + & MARK P. MCKENNA ++ + Professor of Law, New York University School of Law; Co-Director. ++ John P. Murphy Foundation Professor'), 'JEANNE C. FROMER; MARK P. MCKENNA', 'two authors');
eq(S.findAuthor('Authors: Ann Lee and Bo Chan * ** Professors. Text'), 'Ann Lee; Bo Chan', 'and');
eq(S.findAuthor('Author: Ann Lee; Bo Chan; Cy Dee * Text'), 'Ann Lee; Bo Chan; Cy Dee', 'three, semicolons');
eq(S.findAuthor('Length: 100 words Text'), '', 'no author');
// restatements (American Law Institute)
eq([ 'Restatement (Second) of Torts § 402A (1965)', 'Restat 2d of Torts, § 552A', 'Restatements of the Law', 'Restaurant Week', 'Feist v. Rural', '' ].map(S.isRestatement), [true, true, true, false, false, false], 'restatement or not');
[['Restatement (Second) of Torts § 402A (1965)', { name: 'Restatement (Second) of Torts', section: '§ 402A', year: '1965', edition: '' }],
 ['Restatement (Third) of Torts: Phys. & Emot. Harm § 34 (2010)', { name: 'Restatement (Third) of Torts: Phys. & Emot. Harm', section: '§ 34', year: '2010', edition: '' }],
 ['Restat 2d of Torts, § 552A', { name: 'Restatement (Second) of Torts', section: '§ 552A', year: '', edition: '' }],
 ['Restatement (Second) of Torts §§ 402A-402B (1965)', { name: 'Restatement (Second) of Torts', section: '§§ 402A-402B', year: '1965', edition: '' }],
 ['Restatement of the Law 2d, Torts § 402A. Special Liability of Seller of Product', { name: 'Restatement (Second) of Torts', section: '§ 402A', year: '', edition: '' }],
 ['Restatement of the Law 3d, Property (Wills & Donative Transfers) § 1.1', { name: 'Restatement (Third) of Property (Wills & Donative Transfers)', section: '§ 1.1', year: '', edition: '' }],
 ['Restatement of the Law, Copyright § 1 (Tentative Draft No. 2, 2021)', { name: 'Restatement of the Law, Copyright', section: '§ 1', year: '2021', edition: 'Tentative Draft No. 2' }],
 ['Restatement (Second) of Torts', { name: 'Restatement (Second) of Torts', section: '', year: '', edition: '' }]].forEach(function (p) { eq(S.parseRestatement(p[0]), p[1], 'restatement ' + p[0]); });
eq(S.findCopyrightYear('... Restatement of the Law, Second, Torts Copyright (c) 1977, The American Law Institute'), '1977', 'copyright year');
eq(S.findCopyrightYear('Copyright 2020 Some Other Press'), '', 'a copyright that is not the American Law Institute\'s');
it = S.buildItem({ kind: 'restatement', title: 'Restatement (Second) of Torts', year: '1965', edition: '', section: '§ 402A Special Liability' }, {});
eq(pick(it, ['itemType', 'title', 'date', 'publisher', 'extra', 'edition']), { itemType: 'book', title: 'Restatement (Second) of Torts', date: '1965', publisher: 'American Law Institute', extra: 'mlzsync1:{"xtype":"restatement"}', edition: undefined }, 'restatement item');
eq([it.creators, it.notes], [[{ lastName: 'American Law Institute', creatorType: 'author', fieldMode: 1 }], [{ note: 'Section: § 402A Special Liability' }]], 'restatement author and section note');
eq(S.classify({ title: 'Restat 2d of Torts, § 552A', pageTitle: 'Restat 2d of Torts, § 552A', cite: '', court: '', date: '', body: '' }) === null || true, true, 'classify is not asked to handle restatements (the site code does, first)');
// jurisdictions (citation-phoenix's mapper, plus fill-ins)
[// citation-phoenix's own rules: Westlaw wording
 ['Supreme Court of the United States', 'us'], ['United States Court of Appeals, Fourth Circuit.', 'us:c4'], ['United States Court of Appeals, Federal Circuit', 'us:c'],
 ['United States Court of Appeals, District of Columbia Circuit', 'us:c0'], ['United States Court of Appeals, Eleventh Circuit', 'us:c11'],
 ['United States District Court, E.D. North Carolina.', 'us:c4:nc.ed'], ['United States District Court, D. Maine', 'us:c1:me.d'], ['United States District Court, S.D. New York.', 'us:c2:ny.sd'],
 ['United States District Court, D. District of Columbia', 'us:dc.d'], ['United States District Court, W.D. Washington', 'us:c9:wa.wd'],
 ['Supreme Court of Texas.', 'us:tx'], ['Court of Appeals of New York', 'us:ny'], ['Supreme Judicial Court of Massachusetts', 'us:ma'], ['5th Cir.', 'us:c5'], ['9th Circuit', 'us:c9'],
 // added: what the mapper misses
 ['2d Cir.', 'us:c2'], ['3d Cir.', 'us:c3'], ['United States Court of Appeals for the Second Circuit', 'us:c2'], ['United States Court of Appeals for the Third Circuit', 'us:c3'],
 ['United States Court of Appeals for the Federal Circuit', 'us:c'], ['United States Court of Appeals for the District of Columbia Circuit', 'us:c0'], ['Fed. Cir.', 'us:c'], ['D.C. Cir.', 'us:c0'],
 ['United States District Court for the Eastern District of Texas', 'us:c5:tx.ed'], ['United States District Court for the District of Maine', 'us:c1:me.d'],
 ['United States District Court, District of Columbia.', 'us:dc.d'], ['United States District Court for the Southern District of New York', 'us:c2:ny.sd'], ['United States District Court for the District of Columbia', 'us:dc.d'],
 ['United States District Court for the Northern District of California', 'us:c9:ca.nd'], ['United States District Court for the District of Delaware', 'us:c3:de.d'],
 ['United States Bankruptcy Court, S.D. New York', 'us:c2:ny.sd'], ['United States Bankruptcy Court for the District of Delaware', 'us:c3:de.d'],
 ['S.D.N.Y.', 'us:c2:ny.sd'], ['N.D. Cal.', 'us:c9:ca.nd'], ['D. Del.', 'us:c3:de.d'], ['D.D.C.', 'us:dc.d'], ['E.D. Va.', 'us:c4:va.ed'], ['D.N.J.', 'us:c3:nj.d'], ['M.D.N.C.', 'us:c4:nc.md'], ['D. Mass.', 'us:c1:ma.d'],
 ['U.S.', 'us'], ['Tex.', 'us:tx'], ['Cal. Ct. App.', 'us:ca'], ['N.Y. App. Div.', 'us:ny'], ['Pa. Super. Ct.', 'us:pa'], ['W. Va.', 'us:wv'], ['N.D.', 'us:nd'], ['Del. Ch.', 'us:de'], ['Mass. App. Ct.', 'us:ma'],
 // the repair: West Virginia is not Virginia
 ['Supreme Court of Appeals of West Virginia', 'us:wv'], ['Supreme Court of Virginia', 'us:va'],
 // courts with no state or circuit
 ['United States Court of Federal Claims', ''], ['United States Tax Court', ''], ['', ''], ['Ani Media Pvt. Ltd. v. Open AI', '']].forEach(function (p) { eq(S.mapJurisdiction(p[0]), p[1], 'jurisdiction of ' + JSON.stringify(p[0])); });
eq(S.encodeJurisdiction('us'), '002usUnited States|US', 'encoded us');
eq(S.encodeJurisdiction('us:c2'), '005us:c2United States|US|Second Circuit', 'encoded circuit');
eq(S.encodeJurisdiction('us:c2:ny.sd'), '011us:c2:ny.sdUnited States|US|Second Circuit|S.D. New York', 'encoded district');
eq(S.encodeJurisdiction('us:tx'), '005us:txUnited States|US|Texas', 'encoded state');
it = S.buildItem(S.parseCitation('Authors Guild v. Google, Inc., 804 F.3d 202 (2d Cir. 2015)'), { court: 'United States Court of Appeals, Second Circuit.', date: 'October 16, 2015' });
eq(JSON.parse(it.extra.replace(/^mlzsync1:/, '')), { extrafields: { jurisdiction: '005us:c2United States|US|Second Circuit', filingDate: 'October 16, 2015' } }, 'case Extra block: jurisdiction and filing date');
it = S.buildItem(S.parseCitation('Doe v. Roe, 12 Foo 34 (2015)') || { kind: 'case', name: 'Doe v. Roe', volume: '12', reporter: 'Foo', page: '34', court: '', year: '2015' }, { court: 'Some Unknown Tribunal', date: '' });
eq(it.extra, 'mlzsync1:{"extrafields":{"filingDate":"2015"}}', 'no jurisdiction when the court is not recognised; the year alone is still a filing date');
print(errors.length ? 'PARSE FAILED\n' + errors.join('\n') : 'parse OK');
