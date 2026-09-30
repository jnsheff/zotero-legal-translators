/*SHARED*/

// Header markup (Westlaw Edge / Advantage document pages), checked against saved pages:
//   #title (name), #co_docHeaderCitation > #courtline, #filedate, #cite0 #cite1 ... (cases)
//   #cite, #codeSetName, #titleDesc, #effectiveDate (statutes); result titles are a.draggable_document_link
var TITLE_SEL = ['#title', '#co_docHeaderTitleLine', '.co_title', 'h1'];
var RESULT_LINK = 'a.draggable_document_link, a[id^="cobalt_result_"][id$="_title"], a[id^="cobalt_result_"][id*="_title"]';

function isDocumentURL(url) {
	return /\/Document\/I[0-9a-f]+/i.test(url);
}
function isListURL(url) {
	return /\/(?:Search\/(?:Results|ResultList|Home)|Browse\/|Folders?\/|History)/i.test(url) || /[?&]listSource=Search/i.test(url);
}

function readPage(doc) {
	var body = doc.querySelector('#co_document') || doc.querySelector('#co_docContentMain') || doc.querySelector('main') || doc.body;
	var cites = [], nodes = doc.querySelectorAll('#co_docHeaderCitation li[id^="cite"]');
	for (var i = 0; i < nodes.length; i++) cites.push(spacedText(nodes[i]));
	return {
		pageTitle: cleanTitle(doc.title),
		title: cleanTitle(firstText(doc, TITLE_SEL)),
		cites: cites,
		cite: cites[0] || '',
		court: firstText(doc, ['#courtline', '.co_courtLine']),
		date: firstText(doc, ['#filedate', '#effectiveDate', '.co_dateLine']),
		codeSet: firstText(doc, ['#codeSetName']),
		titleDesc: firstText(doc, ['#titleDesc']),
		info: '',
		body: spacedText(body).slice(0, 3000),
	};
}

// Westlaw statute header: cite "NY CIV RTS § 50-f" / "47 U.S.C.A. § 230", title "§ 50-f. Right of publicity"
function statuteFromHeader(page) {
	var cite = page.cite, t = /^\u00a7+\s*([\w.()\-\u2013]+?)\.?\s+(.+)$/.exec(page.title);
	if (!/\u00a7/.test(cite)) return null;
	var m = /^(\d+)\s+(U\.?S\.?C\.?(?:A|S)?\.?|C\.?F\.?R\.?)\s+\u00a7+\s*(\S+)/i.exec(cite), out;
	if (m) {
		var fed = /^C/i.test(m[2]) ? 'C.F.R.' : /A\.?$/i.test(m[2]) ? 'U.S.C.A.' : 'U.S.C.';
		out = { kind: 'statute', codeNumber: m[1], code: fed, section: m[3].replace(/[.,]$/, '') };
	}
	else if ((m = /^([A-Z]{2})\s+.+?\s+\u00a7+\s*(\S+)$/.exec(cite)) && STATE_CODES[m[1]]) {
		out = { kind: 'statute', codeNumber: '', code: page.titleDesc ? stateCodeName(STATE_CODES[m[1]], page.titleDesc) : cite.replace(/\s*\u00a7.*$/, ''), section: m[2] };
	}
	else return null;
	if (t) out.rest = t[2];
	return out;
}

function classifyWestlaw(page) {
	var st = statuteFromHeader(page);
	return st ? { parsed: st, extra: { title: st.rest } } : classify(page);
}

function detectWeb(doc, url) {
	if (isListURL(url) && !isDocumentURL(url) && getSearchResults(doc, true)) return 'multiple';
	if (!isDocumentURL(url)) return false;
	var c = classifyWestlaw(readPage(doc));
	return c ? TYPE_OF[c.parsed.kind] : false;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, seen = {}, found = false;
	var links = doc.querySelectorAll(RESULT_LINK);
	for (var i = 0; i < links.length; i++) {
		var a = links[i], title = spacedText(a);
		if (!title || !a.href || !/\/Document\/I/.test(a.href)) continue;
		// result types other than cases and codes (briefs, practice materials, analytical) are not read yet
		var kind = a.getAttribute('subcontenttype');
		if (kind && !/case|statute|code|regulation|rule/i.test(kind)) continue;
		var id = a.href.replace(/[?#].*$/, ''); // the same document with different query strings
		if (seen[id]) continue;
		seen[id] = 1;
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
				Zotero.debug('Westlaw: skipped ' + u + ': ' + e.message);
			}
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var c = classifyWestlaw(readPage(doc));
	if (!c) throw new Error('Westlaw: could not read a citation from this page');
	var item = buildItem(c.parsed, c.extra);
	item.url = url.replace(/[?#].*$/, '');
	item.libraryCatalog = 'Westlaw';
	item.complete();
}
