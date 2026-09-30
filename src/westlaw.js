/*SHARED*/

// Header markup (Westlaw Edge / Advantage document pages), checked against saved pages:
//   #title (name), #co_docHeaderCitation > #courtline, #filedate, #cite0 #cite1 ... (cases)
//   #cite, #codeSetName, #titleDesc, #effectiveDate (statutes); result titles are a.draggable_document_link
var TITLE_SEL = ['#title', '#co_docHeaderTitleLine', '.co_title', 'h1'];
var RESULT_LINK = 'a.draggable_document_link, a[id^="cobalt_result_"][id$="_title"], a[id^="cobalt_result_"][id*="_title"]';

function isDocumentURL(url) {
	return /\/Document\/[A-Z][0-9a-f]{6,}/i.test(url) // I... cases and articles, N... statutes and rules;
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
		author: firstText(doc, ['#author']),
		treatiseCite: firstText(doc, ['.co_cites']),
		pubTitle: firstText(doc, ['.co_publicationLine .co_headtext']),
		pubDate: firstText(doc, ['.co_publicationLine .co_date']),
		treatiseAuthor: firstText(doc, ['.co_authorLine']),
		publication: firstText(doc, ['#pubname']),
		codeSet: firstText(doc, ['#codeSetName', '#pubName']), // statutes / regulations
		titleDesc: firstText(doc, ['#titleDesc', '#headtext']),
		info: '',
		body: spacedText(body).slice(0, 3000),
	};
}

// Westlaw statute header: cite "NY CIV RTS § 50-f" / "47 U.S.C.A. § 230", title "§ 50-f. Right of publicity"
function statuteFromHeader(page) {
	var cite = page.cite, t = /^\u00a7+\s*([\w.()\-\u2013]+?)\.?\s+(.+)$/.exec(page.title);
	var m = /^(\d+)\s+(U\.?S\.?C\.?(?:A|S)?\.?|C\.?F\.?R\.?)\s+\u00a7+\s*(\S+)/i.exec(cite), out;
	if (m) {
		out = { kind: 'statute', codeNumber: m[1], code: normCode(m[2]), section: m[3].replace(/[.,]$/, '') };
	}
	else if ((m = /^([A-Z]{2})\s+.+?\s+\u00a7+\s*(\S+)$/.exec(cite)) && STATE_CODES[m[1]]) {
		out = { kind: 'statute', codeNumber: '', code: page.titleDesc ? stateCodeName(STATE_CODES[m[1]], page.titleDesc) : cite.replace(/\s*\u00a7.*$/, ''), section: m[2] };
	}
	else if (t && page.codeSet) {
		// no usable citation line: build the code from the code set and the title description
		var tn = /Title (\d+)/i.exec(page.titleDesc), sn = /\bof (.+?)(?: Annotated)?$/.exec(page.codeSet.replace(/[,.]+$/, ''));
		if (/United States Code/i.test(page.codeSet) && tn) out = { kind: 'statute', codeNumber: tn[1], code: 'U.S.C.', section: t[1] };
		else if (/Code of Federal Regulations/i.test(page.codeSet) && tn) out = { kind: 'statute', codeNumber: tn[1], code: 'C.F.R.', section: t[1] };
		else if (sn && STATES[sn[1]]) out = { kind: 'statute', codeNumber: '', code: stateCodeName(sn[1], page.titleDesc || 'Code'), section: t[1] };
		else return null;
	}
	else return null;
	if (t) out.rest = t[2].replace(/\s*\[[^\]]*\]\s*$/, '').replace(/\.$/, ''); // "[Statutory Text & Notes of Decisions subdivisions I to III]"
	return out;
}

// Law-review article: header has #cite "65 STNLR 761", #author, #pubname; the text starts "65 Stan. L. Rev. 761 Stanford Law Review April, 2013"
function articleFromHeader(page) {
	if (!page.publication || !page.title) return null;
	var out = { kind: 'article', title: page.title, author: page.author, publication: page.publication, reporter: '', volume: '', page: '', year: '', date: '' };
	var m = /^\s*(\d{1,4})\s+([A-Z][A-Za-z.&'\u2019 ]*?\.)\s+(\d{1,5})\b/.exec(page.body) || /^\s*(\d{1,4})\s+([A-Z][A-Za-z.&'\u2019 ]*?\.)\s+(\d{1,5})\b/.exec(page.body.replace(/^.*?(?=\b\d{1,4} [A-Z][a-z]*\. )/, ''));
	var c = /^(\d{1,4})\s+\S+\s+(\d{1,5})$/.exec(page.cite);
	if (m) { out.volume = m[1]; out.reporter = squash(m[2]); out.page = m[3]; }
	else if (c) { out.volume = c[1]; out.page = c[2]; out.reporter = page.publication; }
	else return null;
	var after = page.body.slice(page.body.indexOf(page.publication) + page.publication.length);
	var d = new RegExp('^\\s*(' + MONTHS + ')\\.?,?\\s+(?:\\d{1,2},?\\s+)?(\\d{4})', 'i').exec(after) || /Copyright \(c\) (\d{4})/i.exec(page.body);
	if (d) { out.year = d[d.length - 1]; out.date = d.length > 2 ? d[1] + ' ' + d[2] : d[1]; }
	return out;
}

// Treatise section: .co_cites "2 McCarthy on Trademarks and Unfair Competition § 18:2 (5th ed.)", .co_publicationLine
// "McCarthy on Trademarks ... Fifth Edition | September 2026 Update", .co_authorLine "J. Thomas McCarthy"
function treatiseFromHeader(page) {
	if (!page.pubTitle || !page.treatiseCite) return null;
	var m = /^(?:(\d{1,3})\s+)?(.+?)\s+\u00a7+\s*([\w:.\-]+)\s*\((?:(\d+)(?:st|nd|rd|th)\s+ed\.|[^)]*)\)\s*$/.exec(page.treatiseCite);
	if (!m) return null;
	var d = new RegExp('(' + MONTHS + ')\\.?,?\\s+(\\d{4})', 'i').exec(page.pubDate);
	return { kind: 'treatise', title: page.title.replace(/^\u00a7+\s*[\w:.\-]+?\.?\s+/, ''), bookTitle: m[2], volume: m[1] || '', section: m[3], edition: m[4] || '',
		date: d ? d[1] + ' ' + d[2] : (/\b(\d{4})\b/.exec(page.pubDate) || [])[1] || '', author: page.treatiseAuthor };
}

function classifyWestlaw(page) {
	var tr = treatiseFromHeader(page);
	if (tr) return { parsed: tr, extra: {} };
	var st = statuteFromHeader(page);
	if (st) return { parsed: st, extra: { title: st.rest } };
	var art = articleFromHeader(page);
	return art ? { parsed: art, extra: {} } : classify(page);
}

function detectWeb(doc, url) {
	watchForChanges(doc);
	try {
		var type = detect(doc, url);
		Zotero.debug('Westlaw (legal): detectWeb -> ' + type + ' for ' + url.replace(/[?#].*$/, ''));
		if (!type) Zotero.debug('Westlaw (legal): page read as ' + JSON.stringify(readPage(doc), function (k, v) { return k === 'body' ? undefined : v; }));
		return type;
	}
	catch (e) {
		Zotero.debug('Westlaw (legal): detectWeb failed: ' + e + ' ' + (e && e.stack));
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
		Zotero.debug('Westlaw (legal): monitorDOMChanges: ' + e);
	}
}

function detect(doc, url) {
	if (isListURL(url) && !isDocumentURL(url) && !doc.querySelector('#co_docHeaderCitation') && getSearchResults(doc, true)) return 'multiple';
	if (!isDocumentURL(url) && !doc.querySelector('#co_docHeaderCitation')) return false;
	var c = classifyWestlaw(readPage(doc));
	return c ? TYPE_OF[c.parsed.kind] : false;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, seen = {}, found = false;
	var links = doc.querySelectorAll(RESULT_LINK);
	for (var i = 0; i < links.length; i++) {
		var a = links[i], title = spacedText(a);
		if (!title || !a.href || !/\/Document\/[A-Z][0-9a-f]{6,}/i.test(a.href)) continue;
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
	addSnapshot(item, doc);
	item.complete();
}
