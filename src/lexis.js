/*SHARED*/

// Selectors marked (*) are the ones the existing Lexis+ translator in Zotero's repository uses;
// the rest are guesses. The title and citation text are parsed with the shared code.
var TITLE_SEL = ['h1#SS_DocumentTitle', 'h1.SS_DocumentTitle', 'h1']; // (*) first
var CITE_SEL = ['span.active-reporter', 'a.SS_ActiveRptr']; // (*)
var INFO_SEL = 'p.SS_DocumentInfo'; // (*)
var DATE_SEL = ['span.date']; // (*)
var RESULT_LINK = 'a.titleLink'; // (*)

function readPage(doc) {
	var infos = doc.querySelectorAll(INFO_SEL), info = [];
	for (var i = 0; i < infos.length; i++) info.push(spacedText(infos[i]));
	var court = info[0] || '';
	var date = cleanDate(firstText(doc, DATE_SEL)) || findDate(info.join(' '));
	return {
		pageTitle: cleanTitle(doc.title),
		title: cleanTitle(firstText(doc, TITLE_SEL)),
		cite: firstText(doc, CITE_SEL),
		court: /\d/.test(court) && court.length > 80 ? '' : court, // the full court name; the parsed citation's is preferred
		date: date,
		info: info.join('\n'),
		body: info.join(' '),
	};
}

function detectWeb(doc, url) {
	if (doc.title && /\bresults\b/i.test(doc.title) && getSearchResults(doc, true)) return 'multiple';
	var c = classify(readPage(doc));
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
			await scrape(await requestDocument(u), u);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var c = classify(readPage(doc));
	if (!c) throw new Error('Lexis: could not read a citation from this page');
	var item = buildItem(c.parsed, c.extra);
	// Lexis URLs are long session links that do not work for anyone else, so none is saved
	item.libraryCatalog = 'Lexis+';
	item.complete();
}
