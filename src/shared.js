// ---- shared legal-citation parsing (identical in both translators; edit src/shared.js) ----

var MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
var DATE_RE = new RegExp('\\b(' + MONTHS + ')\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b', 'i');

function squash(s) {
	return (s || '').replace(/[\u00a0\s]+/g, ' ').trim();
}

// Strip the site's suffix from a page title ("... - Westlaw", "... | Lexis+")
function cleanTitle(s) {
	return squash(s).replace(/\s*[-|\u2013\u2014]\s*(Westlaw(?: Edge| Next)?|Lexis\+?(?: Advance)?|Lexis(?:Nexis)?|Thomson Reuters)\b.*$/i, '');
}

// "S.D.N.Y. Jan. 1, 2023" / "9th Cir. 2001" / "1991" -> { court, date, year }
function parseParen(p) {
	p = squash(p);
	var out = { court: '', date: '', year: '' };
	var m = DATE_RE.exec(p);
	if (m) {
		out.date = m[1] + ' ' + m[2] + ', ' + m[3];
		out.year = m[3];
		out.court = squash(p.replace(m[0], ''));
	}
	else if ((m = /\b(\d{4})\b\s*$/.exec(p))) {
		out.year = m[1];
		out.date = m[1];
		out.court = squash(p.slice(0, m.index));
	}
	else {
		out.court = p;
	}
	out.court = out.court.replace(/[,\s]+$/, '');
	return out;
}

var NOT_A_CASE_RE = /\b(?:L\.? ?Rev|L\.? ?J\b|Law Review|Law Journal|Rev\.|Q\.|Stud\.|Pol'y|J\.)/;

// A full citation as a Bluebook string. Returns null if it is not a case or article citation.
//   Name v. Name, 499 U.S. 340, 345 (1991)
//   Name v. Name, 2023 WL 123456, at *3 (S.D.N.Y. Jan. 1, 2023)
//   Name v. Name, 2023 U.S. Dist. LEXIS 1234 (D. Del. Jan. 1, 2023)
//   Author, Title, 102 Harv. L. Rev. 1, 5 (1989)
function parseCitation(text) {
	text = squash(text);
	var m, out;

	// unpublished: WL and LEXIS numbers, "2023 WL 123456"
	m = /^(.+?),?\s+(\d{4})\s+((?:WL)|(?:[A-Z][A-Za-z.]*(?: [A-Z][A-Za-z.]*)*? LEXIS))\s+(\d+)(?:,?\s*at\s*\*+\s*[\d\-\u2013, ]+)?\s*\(([^)]*)\)/.exec(text);
	if (m) {
		var pp = parseParen(m[5]);
		return { kind: 'case', name: m[1].replace(/,$/, ''), volume: m[2], reporter: m[3], page: m[4], court: pp.court, date: pp.date, year: pp.year || m[2] };
	}

	// reported: volume reporter page [, pinpoint] (court year)
	m = /^(.+?),?\s+(\d{1,4})\s+([A-Z][A-Za-z0-9.'&\u2019 ]*?)\s+(\d{1,5})(?:,\s*(?:at\s*)?\*?[\d\-\u2013*n, ]+)?\s*\(([^)]*\d{4}[^)]*)\)/.exec(text);
	if (m && /[.']/.test(m[3])) {
		out = parseParen(m[5]);
		out.volume = m[2];
		out.reporter = squash(m[3]);
		out.page = m[4];
		out.name = m[1].replace(/,$/, '');
		var isCase = /\bv\.? |^In re |^Ex parte |^Matter of |^United States\b|^State\b|^People\b/.test(out.name);
		if (!isCase && NOT_A_CASE_RE.test(out.reporter)) {
			out.kind = 'article';
			out.author = '';
			var t = /^((?:[A-Z][\w.'\u2019\-]+(?: [A-Z][\w.'\u2019\-]*){0,3})(?: (?:&|and) [A-Z][\w.'\u2019\-]+(?: [A-Z][\w.'\u2019\-]*){0,3})*),\s+(.+)$/.exec(out.name);
			if (t) { out.author = t[1]; out.title = t[2]; }
			else out.title = out.name;
		}
		else out.kind = 'case';
		return out;
	}
	return null;
}

// Statutes and regulations
//   47 U.S.C.A. \u00a7 230(c)   /   Cal. Civ. Code \u00a7 1798.100   /   17 C.F.R. \u00a7 240.10b-5
function parseStatute(text) {
	text = squash(text);
	var m = /^(\d{1,3})\s+([A-Z][A-Za-z.&'\u2019 ]*?[A-Za-z.])\s+(?:\u00a7+|Sec(?:tions?|s?)\.?)\s*([\w.()\-\u2013,]+)/.exec(text);
	var out;
	if (m) out = { kind: 'statute', codeNumber: m[1], code: squash(m[2]), section: m[3].replace(/[,.]$/, '') };
	else if ((m = /^([A-Z][A-Za-z.&'\u2019 ]*?[A-Za-z.])\s+(?:\u00a7+|Sec(?:tions?|s?)\.?)\s*([\w.()\-\u2013,]+)/.exec(text))) {
		out = { kind: 'statute', codeNumber: '', code: squash(m[1]), section: m[2].replace(/[,.]$/, '') };
	}
	else return null;
	out.rest = squash(text.slice(m[0].length)).replace(/^[\s,:;\u2013\u2014-]+/, '');
	var y = /\((?:[^)]*?)(\d{4})\)/.exec(out.rest);
	if (y) out.year = y[1];
	var pl = /(?:Pub(?:lic|\.)? ?L(?:aw|\.)?(?: ?No\.)?|P\.L\.)\s*(\d+-\d+)/i.exec(text);
	if (pl) out.publicLawNumber = pl[1];
	return out;
}

// Trim Westlaw/Lexis all-caps names ("FEIST PUBLICATIONS, INC. v. ...") into title case
function fixCase(s) {
	s = squash(s);
	var letters = s.replace(/[^A-Za-z]/g, ''), upper = s.replace(/[^A-Z]/g, '');
	if (letters.length > 3 && upper.length / letters.length > 0.8) {
		s = ZU.capitalizeTitle(s.toLowerCase(), true).replace(/\s[Vv]\.?\s/g, ' v. ');
	}
	return s;
}

// A Zotero item from a parsed citation; `extra` = fields read from the page that fill any gaps.
function buildItem(parsed, extra) {
	extra = extra || {};
	var item, court, date, m;
	if (parsed.kind === 'statute') {
		item = new Zotero.Item('statute');
		item.nameOfAct = extra.title || (parsed.rest && !/^\(/.test(parsed.rest) ? parsed.rest.replace(/\s*\([^)]*\d{4}\)\s*$/, '') : '');
		item.code = parsed.code;
		item.codeNumber = parsed.codeNumber;
		item.section = parsed.section;
		if (parsed.publicLawNumber) item.publicLawNumber = parsed.publicLawNumber;
		if (extra.date) item.dateEnacted = extra.date;
		return item;
	}
	if (parsed.kind === 'article') {
		item = new Zotero.Item('journalArticle');
		item.title = parsed.title;
		if (parsed.author) {
			parsed.author.split(/\s+(?:&|and)\s+/).forEach(function (a) {
				item.creators.push(ZU.cleanAuthor(a, 'author'));
			});
		}
		item.publicationTitle = parsed.reporter;
		item.volume = parsed.volume;
		item.pages = parsed.page;
		item.date = parsed.year;
		return item;
	}
	item = new Zotero.Item('case');
	item.caseName = fixCase(parsed.name);
	court = parsed.court || extra.court || '';
	item.court = court;
	item.reporter = parsed.reporter;
	item.reporterVolume = parsed.volume;
	item.firstPage = parsed.page;
	date = parsed.date || extra.date || parsed.year || '';
	item.dateDecided = extra.date && /\d{4}/.test(extra.date) && extra.date.length > (parsed.date || '').length ? extra.date : date;
	if (extra.docket) item.docketNumber = extra.docket;
	return item;
}

// Docket number in a block of text ("No. 89-1909", "Civil Action No. 1:24-cv-01234")
function findDocket(text) {
	var re = /\b((?:Civil Action |Civ\. ?(?:A\. )?|Case |Docket |Cause )?Nos?\.?\s*[\w:\-.\u2013,\/ ]{2,40}?)(?=\s*(?:\n|$|;|\(|\u00b6|[A-Z][a-z]+ \d))/gi, m;
	text = text || '';
	while ((m = re.exec(text))) {
		if (/\d/.test(m[1])) return squash(m[1]).replace(/[,;.]$/, '');
	}
	return '';
}
// "March 27, 1991, Decided" -> "March 27, 1991"
function cleanDate(s) {
	return squash(s).replace(/[,;\s]*\b(?:Decided|Filed|Argued|Submitted|Entered|Amended)\b.*$/i, '');
}
function findDate(text) {
	var m = DATE_RE.exec(text || '');
	return m ? m[1] + ' ' + m[2] + ', ' + m[3] : '';
}
// ---- end shared ----

// Text of an element with a space between text nodes (textContent glues neighbouring blocks together)
function spacedText(el) {
	if (!el) return '';
	var w = el.ownerDocument.createTreeWalker(el, 4), parts = [], n;
	while ((n = w.nextNode())) parts.push(n.nodeValue);
	return squash(parts.join(' '));
}

// First non-empty text among CSS selectors
function firstText(doc, selectors) {
	for (var i = 0; i < selectors.length; i++) {
		var el = doc.querySelector(selectors[i]);
		var t = spacedText(el);
		if (t) return t;
	}
	return '';
}

// Work out what a document page is. `page` = { pageTitle, title, cite, court, date, body }
function classify(page) {
	page.date = cleanDate(page.date);
	var paren = squash([page.court, page.date].filter(Boolean).join(' '));
	var tries = [page.pageTitle, page.title];
	if (page.title && page.cite) tries.push(page.title + ', ' + page.cite + (paren ? ' (' + paren + ')' : ''));
	var parsed = null;
	for (var i = 0; i < tries.length && !parsed; i++) parsed = tries[i] && parseCitation(tries[i]);
	var extra = { court: page.court, date: findDate(page.date) || findDate(page.body) || '', docket: findDocket((page.info || '') + '\n' + (page.body || '').slice(0, 300)) };
	if (parsed) {
		if (parsed.kind === 'case' && parsed.date && /^\d{4}$/.test(parsed.date) && extra.date && extra.date.slice(-4) === parsed.date) parsed.date = extra.date;
		return { parsed: parsed, extra: extra };
	}
	var st = [page.title, page.pageTitle, page.title + ' ' + page.cite].reduce(function (r, t) { return r || (t && parseStatute(t)); }, null);
	return st ? { parsed: st, extra: { date: extra.date } } : null;
}

var TYPE_OF = { 'case': 'case', statute: 'statute', article: 'journalArticle' };
