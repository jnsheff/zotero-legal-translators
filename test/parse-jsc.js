// Citation parsing and item building (no DOM). Run: jsc test/parse-jsc.js
var errors = [];
var Zotero = { Item: function (t) { this.itemType = t; this.creators = []; } };
var ZU = { capitalizeTitle: function (s) { return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); },
	cleanAuthor: function (a) { var p = a.split(' '); return { firstName: p.slice(0, -1).join(' '), lastName: p.slice(-1)[0], creatorType: 'author' }; } };
eval(read('src/shared.js') + '; this.S = { parseCitation: parseCitation, parseStatute: parseStatute, buildItem: buildItem, cleanTitle: cleanTitle, findDocket: findDocket, findDate: findDate, classify: classify };');
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
eq(pick(s, ['codeNumber', 'code', 'section', 'rest']), { codeNumber: '47', code: 'U.S.C.A.', section: '230', rest: 'Protection for private blocking and screening of offensive material' }, 'USC');
eq(pick(S.parseStatute('Cal. Civ. Code § 1798.100'), ['codeNumber', 'code', 'section']), { codeNumber: '', code: 'Cal. Civ. Code', section: '1798.100' }, 'state code');
eq(pick(S.parseStatute('17 C.F.R. § 240.10b-5'), ['code', 'section']), { code: 'C.F.R.', section: '240.10b-5' }, 'CFR');
eq(pick(S.parseStatute('Tex. Bus. & Com. Code Ann. § 26.01(b)'), ['code', 'section']), { code: 'Tex. Bus. & Com. Code Ann.', section: '26.01(b)' }, 'Tex.');
eq(S.parseStatute('Feist v. Rural'), null, 'no section sign');

eq(S.cleanTitle('Feist v. Rural, 499 U.S. 340 (1991) - Westlaw Edge'), 'Feist v. Rural, 499 U.S. 340 (1991)', 'title suffix');
eq(S.cleanTitle('Some title | Lexis+'), 'Some title', 'lexis suffix');
eq(S.findDocket('Court\nNo. 24-cv-1234 (ABC)\nfoo'), 'No. 24-cv-1234', 'docket');
eq(S.findDate('decided Mar. 27, 1991 by the court'), 'Mar 27, 1991', 'date');

var it = S.buildItem(S.parseCitation('FEIST PUBLICATIONS, INC. v. RURAL TELEPHONE, 499 U.S. 340 (1991)'), { court: 'Supreme Court of the United States', date: 'Mar 27, 1991', docket: 'No. 89-1909' });
eq(pick(it, ['itemType', 'caseName', 'reporter', 'reporterVolume', 'firstPage', 'court', 'dateDecided', 'docketNumber']),
	{ itemType: 'case', caseName: 'Feist Publications, Inc. v. Rural Telephone', reporter: 'U.S.', reporterVolume: '499', firstPage: '340', court: 'Supreme Court of the United States', dateDecided: 'Mar 27, 1991', docketNumber: 'No. 89-1909' }, 'case item (page court/date fill gaps)');
it = S.buildItem(S.parseCitation('Authors Guild v. Google, Inc., 804 F.3d 202 (2d Cir. 2015)'), { date: 'Oct. 16, 2015' });
eq(pick(it, ['court', 'dateDecided']), { court: '2d Cir.', dateDecided: 'Oct. 16, 2015' }, 'the citation\'s court wins; the page\'s full date replaces a bare year');
it = S.buildItem(S.parseStatute('47 U.S.C.A. § 230 Protection for blocking'), {});
eq(pick(it, ['itemType', 'code', 'codeNumber', 'section', 'nameOfAct']), { itemType: 'statute', code: 'U.S.C.A.', codeNumber: '47', section: '230', nameOfAct: 'Protection for blocking' }, 'statute item');
it = S.buildItem(S.parseCitation('Lawrence Lessig, Code and Other Laws, 113 Harv. L. Rev. 501 (2000)'), {});
eq([it.itemType, it.creators.length, it.publicationTitle, it.pages, it.date], ['journalArticle', 1, 'Harv. L. Rev.', '501', '2000'], 'article item');
print(errors.length ? 'PARSE FAILED\n' + errors.join('\n') : 'parse OK');
