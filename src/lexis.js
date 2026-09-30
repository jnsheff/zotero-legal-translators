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

function readPage(doc) {
	var infos = doc.querySelectorAll(INFO_SEL), info = [];
	for (var i = 0; i < infos.length; i++) info.push(spacedText(infos[i]));
	var court = info[0] || '', title = cleanTitle(firstText(doc, TITLE_SEL));
	var date = cleanDate(firstText(doc, DATE_SEL)) || findDate(info.join(' ')) || (info.filter(function (i) { return /^(?:\w+\.?,? )?\d{4}$|^[A-Z][a-z]+\.?,? \d{4}$/.test(i); })[0] || ''); // articles: "October, 2012"
	return {
		pageTitle: cleanTitle(doc.title),
		title: title,
		cite: firstText(doc, CITE_SEL),
		court: /\b(?:Court|Circuit|Tribunal|Judicial|Bankruptcy|Board|Commission)\b/i.test(court) && court.length < 120 ? court : '', // not "Current through ..." (codes, regulations)
		date: date,
		info: info.join('\n'),
		body: bodyAfter(doc, title),
		banner: firstText(doc, ['h2.SS_Banner']),
		crumb: firstText(doc, ['.SS_TOCTrail li a']),
		author: findAuthor(bodyAfter(doc, title)),
	};
}

function detectWeb(doc, url) {
	watchForChanges(doc);
	try {
		var type = detect(doc, url);
		Zotero.debug('Lexis (legal): detectWeb -> ' + type + ' for ' + url.replace(/[?#].*$/, ''));
		if (!type) Zotero.debug('Lexis (legal): page read as ' + JSON.stringify(readPage(doc), function (k, v) { return k === 'body' ? undefined : v; }));
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

// Treatise section: h1 "8 Gilson on Trademarks 1207", breadcrumb trail starting with the book title,
// banner (h2.SS_Banner) "1207 Refusal on Basis of ..."
function treatiseFromPage(page) {
	var m = /^(\d{1,3})\s+(.+?)\s+(\d[\w.:\-]*)$/.exec(page.title), b = /^(\S+)\s+(.+)$/.exec(page.banner || '');
	if (!m || !b || b[1] !== m[3] || /\u00a7/.test(page.title)) return null;
	return { kind: 'treatise', title: b[2], bookTitle: page.crumb || m[2], volume: m[1], section: m[3], edition: '', date: '', author: '' };
}

function classifyLexis(page) {
	var tr = treatiseFromPage(page);
	return tr ? { parsed: tr, extra: {} } : classify(page);
}

function detect(doc, url) {
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
				await scrape(await requestDocument(u), u);
			}
			catch (e) {
				Zotero.debug('Lexis: skipped ' + u + ': ' + e.message); // news, agency decisions, etc.
			}
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var c = classifyLexis(readPage(doc));
	if (!c) throw new Error('Lexis: could not read a citation from this page');
	var item = buildItem(c.parsed, c.extra);
	// Lexis URLs are long session links that do not work for anyone else, so none is saved
	item.libraryCatalog = 'Lexis+';
	item.complete();
}
