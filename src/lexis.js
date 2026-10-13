/*SHARED*/

// Selectors marked (*) are the ones the existing Lexis+ translator in Zotero's repository uses;
// the rest are guesses. The title and citation text are parsed with the shared code.
var TITLE_SEL = ['h1#SS_DocumentTitle', 'h1.SS_DocumentTitle', 'h1']; // (*) first
var CITE_SEL = ['span.active-reporter', 'a.SS_ActiveRptr']; // (*)
var INFO_SEL = 'p.SS_DocumentInfo'; // (*)
var DATE_SEL = ['span.date']; // (*)
var RESULT_LINK = 'a.titleLink'; // (*)

// Text of the document after its title (used to find the section heading of a statute)
function bodyAfter(doc, title) {
	var t = spacedText(doc.querySelector('.document-wrapper, #document-content, main') || doc.body);
	var i = title ? t.indexOf(title) : -1;
	return t.slice(i < 0 ? 0 : i, (i < 0 ? 0 : i) + 4000);
}

// The History section of a state regulation: the text after the "History" banner (#JUMPTO_History), up to the next banner
function historyText(doc) {
	var h = doc.getElementById('JUMPTO_History'), out = [], n = h && h.nextSibling;
	while (n && !(n.nodeType === 1 && /^H[1-6]$/.test(n.nodeName))) {
		out.push(n.textContent);
		n = n.nextSibling;
	}
	return squash(out.join(' ')).replace(/\s*Annotations.*$/, '').slice(0, 3000); // the notes that follow cite other laws and other dates
}

function readPage(doc) {
	var infos = doc.querySelectorAll(INFO_SEL), info = [];
	for (var i = 0; i < infos.length; i++) info.push(spacedText(infos[i]));
	var court = info[0] || '', title = cleanTitle(firstText(doc, TITLE_SEL)).replace(/,\s*Part \d+ of \d+$/i, ''); // a long section is split: "35 USCS \u00a7 101, Part 1 of 2"
	var rptrs = [], rn = doc.querySelectorAll('a.SS_ActiveRptr, span.SS_NonPaginatedRptr');
	for (var r = 0; r < rn.length; r++) rptrs.push(squash(rn[r].textContent));
	var date = cleanDate(firstText(doc, DATE_SEL)) || findDate(info.join(' ')) || (info.filter(function (i) {
		return /^(?:\w+\.?,? )?\d{4}$|^[A-Z][a-z]+\.?,? \d{4}$/.test(i);
	})[0] || ''); // articles: "October, 2012"
	return {
		pageTitle: cleanTitle(doc.title),
		title: title,
		cite: firstText(doc, CITE_SEL),
		court: /\b(?:Court|Circuit|Tribunal|Judicial|Bankruptcy|Board|Commission)\b/i.test(court) && court.length < 120 ? court : '', // not "Current through ..." (codes, regulations)
		date: date,
		info: info.join('\n'),
		body: bodyAfter(doc, title),
		banner: firstText(doc, ['h2.SS_Banner']),
		copyright: isRestatement(title) && !/^Model Penal Code/i.test(title) ? findCopyrightYear(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body)) : '', // the year is on the last line of the document
		effectiveNote: (/EFFECTIVE DATE NOTE:(.*?)(?:\]|$)/.exec(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body)) || [])[1] || '', // C.F.R.: "... effective Jan. 8, 2021."
		history: historyText(doc),
		refersTo: (/Find references to this ([a-z]+)/.exec(doc.body ? doc.body.textContent : '') || [])[1] || '', // the Info pane: "Find references to this treatise"
		reporters: rptrs, // "140 Stat. 1026", "119 P.L. 111": the session law's citations
		heading: /\bCLS\b/.test(title) ? (/Heading\s+.*?Consolidated Laws Service\s+(.+?)\s+\((?:Arts?|Chs?|Titles?|Parts?|\u00a7)/.exec(spacedText(doc.querySelector('.document-wrapper, #document-content, main') || doc.body)) || [])[1] || '' : '', // New York: "Civil Rights Law (Arts. 1 \u2014 15)"
		crumb: firstText(doc, ['.SS_TOCTrail li a']),
		author: findAuthor(bodyAfter(doc, title)),
	};
}

function detectWeb(doc, url) {
	watchForChanges(doc);
	try {
		var type = detect(doc);
		Zotero.debug('Lexis (legal): detectWeb -> ' + type + ' for ' + url.replace(/[?#].*$/, ''));
		if (!type) Zotero.debug('Lexis (legal): page read as ' + JSON.stringify(readPage(doc), function (k, v) {
			return k === 'body' ? undefined : v;
		}));
		return type;
	}
	catch (e) {
		Zotero.debug('Lexis (legal): detectWeb failed: ' + e + ' ' + (e && e.stack));
		throw e;
	}
}

// The site draws the document after the page has loaded (and replaces it when you navigate within the
// site), so ask the connector to run detection again when the page changes.
function watchForChanges(doc) {
	try {
		// Every time: the connector allows one observer and drops it after the first change, then runs
		// detection again, so it has to be asked again on each run or later changes are missed.
		if (doc.body && typeof Z !== 'undefined' && Z.monitorDOMChanges) Z.monitorDOMChanges(doc.body, { childList: true, subtree: true });
	}
	catch (e) {
		Zotero.debug('Lexis (legal): monitorDOMChanges: ' + e);
	}
}

// Restatement section: h1 and <title> "Restat 2d of Torts, \u00a7 552A", banner (h2.SS_Banner) "\u00a7 552A Contributory Negligence";
// the last line of the document says "Copyright (c) 1977, The American Law Institute" (the Model Penal Code's says "Copyright2026, American Law Institute": the year of the page, not of the text)
function restatementFromPage(page) {
	if (!isRestatement(page.title)) return null;
	var p = parseRestatement(page.title);
	return { kind: 'restatement', title: p.name, year: p.year || page.copyright, edition: p.edition,
		section: p.section && (page.banner || '').indexOf(p.section) === 0 ? page.banner : p.section };
}

// Treatise section: h1 "8 Gilson on Trademarks 1207", breadcrumb trail starting with the book title,
// banner (h2.SS_Banner) "1207 Refusal on Basis of ..."
function treatiseFromPage(page) {
	// "8 Gilson on Trademarks 1207" (banner "1207 Refusal ...") or "2 Nimmer on Copyright \u00a7 8.02" (banner "\u00a7 8.02 The Reproduction Right")
	var m = /^(\d{1,3})\s+(.+?)\s+(?:\u00a7+\s*)?(\d[\w.:-]*)$/.exec(page.title), b = /^(?:\u00a7+\s*)?(\S+)\s+(.+)$/.exec(page.banner || '');
	if (!m || !b || b[1] !== m[3]) return null;
	if ((/\u00a7/.test(page.title) || /^\u00a7/.test(page.banner)) && page.refersTo !== 'treatise') return null; // a section sign could be a code ("35 USCS \u00a7 101", "37 CFR 42.108"); the page says "Find references to this treatise"
	return { kind: 'treatise', title: b[2], bookTitle: page.crumb || m[2], volume: m[1], section: m[3], edition: '', date: '', author: '' };
}

// Session law (an act): h1 "Lindsey O. Graham Sanctioning Russia and Iran Act of 2026, 2026 Enacted H.R. 5334, 119 Enacted H.R. 5334",
// reporters "119 P.L. 111" and "140 Stat. 1026", info "Enacted, September 18, 2026"
function sessionLawFromPage(page) {
	if (/\u00a7/.test(page.title)) return null;
	var stat = null, pl = null;
	page.reporters.forEach(function (r) {
		stat = stat || /^(\d+)\s+Stat\.\s+(\d+)/.exec(r);
		pl = pl || /^(\d+)\s+P\.L\.\s+(\d+)/.exec(r);
	});
	if (!stat && !pl) return null;
	var name = squash(page.title.replace(/,\s*\d{4}\s+Enacted\b.*$/i, '').replace(/,\s*\d+\s+Enacted\b.*$/i, ''));
	return { kind: 'statute', codeNumber: stat ? stat[1] : '', code: stat ? 'Stat.' : '', section: stat ? stat[2] : '', publicLawNumber: pl ? pl[1] + '-' + pl[2] : '', session: pl ? pl[1] : '',
		rest: name, date: findDate(page.info) };
}

function classifyLexis(page) {
	var sl = sessionLawFromPage(page);
	if (sl) return { parsed: sl, extra: { title: sl.rest, date: sl.date } };
	var rs = restatementFromPage(page);
	if (rs) return { parsed: rs, extra: {} };
	var tr = treatiseFromPage(page);
	if (tr) return { parsed: tr, extra: {} };
	var c = classify(page), cls = c && c.parsed.kind === 'statute' && /^([A-Z]{2}) CLS\b/.exec(c.parsed.code);
	if (cls && STATE_CODES[cls[1]] && page.heading) c.parsed.code = stateCodeName(STATE_CODES[cls[1]], page.heading); // "NY CLS Civ R" -> "N.Y. Civil Rights Law"
	if (c && c.parsed.kind === 'statute' && isRegulationCode(c.parsed.code)) {
		// a regulation is dated by the latest of: the Federal Register notices listed in its History ("85 FR 79120, 79129, Dec. 9, 2020"),
		// the dates in an Effective Date Note, and a state History line's "effective 06/01/26"; never by "current through"
		c.extra.date = laterDate([latestDate(page.history), latestDate(page.effectiveNote), latestNumericEffective(page.history)]);
	}
	else if (c && c.parsed.kind === 'statute') {
		// a codified statute: the latest effective date in its History ("L 2025, ch 616, \u00a7 1, effective December 11, 2025"), else the latest
		// date there (the act's, "July 19, 1952, ch 950"); never "current through"
		c.extra.date = latestDate(effectiveDates(page.history)) || latestDate(page.history) || '';
	}
	return c;
}

function detect(doc) {
	if (doc.title && /\bresults\b/i.test(doc.title) && getSearchResults(doc, true)) return 'multiple';
	var c = classifyLexis(readPage(doc));
	return c ? TYPE_OF[c.parsed.kind] : false;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, found = false;
	var links = doc.querySelectorAll(RESULT_LINK);
	for (var i = 0; i < links.length; i++) {
		var a = links[i], title = spacedText(a);
		if (!title || !a.href) continue;
		if (checkOnly) return true;
		found = true;
		items[a.href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let u of Object.keys(items)) {
			try {
				await scrape(await requestDocument(u));
			}
			catch (e) {
				Zotero.debug('Lexis: skipped ' + u + ': ' + e.message); // news, agency decisions, etc.
			}
		}
	}
	else {
		await scrape(doc);
	}
}

// A treatise's authors, publisher and currency are in the Info pane's "Source Information" dialog (#sourceInfoContent), which the page
// draws when the link under "Source Information" is clicked: "Publisher: Matthew Bender & Company, Inc.", "Coverage: Through August 2026;
// Release No. 126", "Description: AUTHORS: Melville B. Nimmer, author 1963-85; David Nimmer, revision author 1986 to present. ..."
// Coverage reads "Through August 2026; Release No. 126" or "Current through the 2007 Edition."
function parseSourceInfo(el) {
	var t = el ? spacedText(el) : '', pub = /Publisher:\s*(.+?)\s+(?:Coverage|Frequency|Update Schedule|Description):/.exec(t),
		cov = new RegExp('Coverage:\\s*(?:Current\\s+)?through\\s+(?:the\\s+)?((?:(?:' + MONTHS + ')\\.?\\s+)?\\d{4})', 'i').exec(t),
		au = /AUTHORS?:\s*(.{0,400})/.exec(t), names = [], m, nameRE = /([A-Z][\w.'\u2019-]*(?:\s+[A-Z][\w.'\u2019-]*)+),\s+(?:[a-z]+\s+)*(?:author|editor)\b/g;
	while (au && (m = nameRE.exec(au[1]))) names.push(m[1]); // "Melville B. Nimmer, author 1963-85; David Nimmer, revision author 1986 to present."
	return { publisher: pub ? pub[1] : '', date: cov ? cov[1] : '', author: names.join('; ') };
}

function pause(ms) {
	return Zotero.Promise && Zotero.Promise.delay ? Zotero.Promise.delay(ms) : new Promise(function (r) {
		setTimeout(r, ms);
	});
}

// The dialog is not in the saved page until the link is clicked, so click it (and close the dialog afterwards)
async function readSourceInfo(doc) {
	var content = doc.getElementById('sourceInfoContent'), opened = false;
	if (!content) {
		var links = doc.querySelectorAll('.docinfolink'), link = null;
		for (var i = 0; i < links.length && !link; i++) {
			if (/Source Information/.test(links[i].textContent)) link = links[i].querySelector('a');
		}
		if (!link) return {};
		try {
			link.click();
			opened = true;
			for (var tries = 0; tries < 20 && !(content = doc.getElementById('sourceInfoContent')); tries++) await pause(150);
		}
		catch (e) {
			Zotero.debug('Lexis (legal): source information: ' + e);
		}
	}
	var info = parseSourceInfo(content);
	if (opened) {
		try {
			var close = doc.querySelector('#sourceinfo-dialog [data-action="cancel"]');
			if (close) close.click();
		}
		catch (e) {
			Zotero.debug('Lexis (legal): closing source information: ' + e);
		}
	}
	return info;
}

async function scrape(doc) {
	var c = classifyLexis(readPage(doc));
	if (!c) throw new Error('Lexis: could not read a citation from this page');
	if (c.parsed.kind === 'treatise') {
		var si = await readSourceInfo(doc), cp = /Copyright (\d{4}), ([^,]+?(?:, Inc\.)?), a member of/.exec(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body));
		c.parsed.author = c.parsed.author || si.author;
		c.parsed.publisher = si.publisher || (cp ? cp[2] : '');
		c.parsed.date = c.parsed.date || si.date || (cp ? cp[1] : '');
	}
	var item = buildItem(c.parsed, c.extra);
	// Lexis URLs are long session links that do not work for anyone else, so none is saved
	item.libraryCatalog = 'Lexis+';
	addSnapshot(item, doc);
	item.complete();
}
