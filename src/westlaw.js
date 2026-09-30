/*SHARED*/

// Selectors are from memory of Westlaw's markup and have not been checked against live pages;
// the page title and citation line are parsed with the shared code, so they are the fallback.
var TITLE_SEL = ['#title', 'h1#title', '.co_title', '#co_docHeaderTitle', 'h1'];
var CITE_SEL = ['#cites', '.co_cites', '#co_docHeaderCitation', '.co_docHeaderCitation', '.co_cite'];
var COURT_SEL = ['#courtline', '.co_courtLine', '#co_courtLine', '.co_court'];
var DATE_SEL = ['#courtline .date', '.co_dateLine', '#dateline', '.co_date'];
var DOC_LINK = 'a[href*="/Document/I"]';

function isDocumentURL(url) {
	return /\/Document\/I[0-9a-f]+/i.test(url);
}
function isListURL(url) {
	return /\/(?:Search\/(?:Results|ResultList|Home)|Browse\/|Folders?\/|History)/i.test(url) || /[?&]listSource=Search/i.test(url);
}

function readPage(doc) {
	var body = doc.querySelector('#co_document, #co_docContentMain, main, body');
	return {
		pageTitle: cleanTitle(doc.title),
		title: cleanTitle(firstText(doc, TITLE_SEL)),
		cite: firstText(doc, CITE_SEL),
		court: firstText(doc, COURT_SEL),
		date: firstText(doc, DATE_SEL),
		info: firstText(doc, COURT_SEL),
		body: spacedText(body).slice(0, 3000),
	};
}

function detectWeb(doc, url) {
	if (isListURL(url) && !isDocumentURL(url) && getSearchResults(doc, true)) return 'multiple';
	if (!isDocumentURL(url)) return false;
	var c = classify(readPage(doc));
	return c ? TYPE_OF[c.parsed.kind] : false;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, seen = {}, found = false;
	var links = doc.querySelectorAll(DOC_LINK);
	for (var i = 0; i < links.length; i++) {
		var a = links[i], title = spacedText(a);
		if (!title || !a.href || /Related|Cited|Citing|History/i.test(a.getAttribute('data-id') || '')) continue;
		var href = a.href.replace(/#.*$/, '');
		var id = href.replace(/\?.*$/, ''); // the same document with different query strings
		if (seen[id]) continue;
		seen[id] = 1;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let u of Object.keys(items)) {
			await scrape(await requestDocument(u), u);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var c = classify(readPage(doc));
	if (!c) throw new Error('Westlaw: could not read a citation from this page');
	var item = buildItem(c.parsed, c.extra);
	item.url = url.replace(/[?#].*$/, '');
	item.libraryCatalog = 'Westlaw';
	item.complete();
}
