/*SHARED*/

// Header markup (Westlaw Edge / Advantage document pages), checked against saved pages:
//   #title (name), #co_docHeaderCitation > #courtline, #filedate, #cite0 #cite1 ... (cases)
//   #cite, #codeSetName, #titleDesc, #effectiveDate (statutes); result titles are a.draggable_document_link
var TITLE_SEL = ['#title', '#co_docHeaderTitleLine', '.co_title', 'h1'];
var RESULT_LINK = 'a.draggable_document_link, a[id^="cobalt_result_"][id$="_title"], a[id^="cobalt_result_"][id*="_title"]';

function isDocumentURL(url) {
	// I... ids are cases and articles, N... statutes and rules
	return /\/Document\/[A-Z][0-9a-f]{6,}/i.test(url);
}
function isListURL(url) {
	return /\/(?:Search\/(?:Results|ResultList|Home)|Browse\/|Folders?\/|History)/i.test(url) || /[?&]listSource=Search/i.test(url);
}

function readPage(doc) {
	var body = doc.querySelector('#co_document') || doc.querySelector('#co_docContentMain') || doc.querySelector('main') || doc.body;
	var cites = [], nodes = doc.querySelectorAll('#co_docHeaderCitation li[id^="cite"]');
	for (var i = 0; i < nodes.length; i++) cites.push(spacedText(nodes[i]));
	var heads = [], headNodes = doc.querySelectorAll('.co_headtext');
	for (var j = 0; j < headNodes.length; j++) heads.push(spacedText(headNodes[j]));
	return {
		pageTitle: cleanTitle(doc.title),
		title: cleanTitle(firstText(doc, TITLE_SEL)),
		cites: cites,
		cite: cites[0] || '',
		court: firstText(doc, ['#courtline', '.co_courtLine']),
		date: firstText(doc, ['#filedate', '#effectiveDate', '.co_dateLine']),
		author: firstText(doc, ['#author']),
		treatiseCite: firstText(doc, ['.co_cites']),
		headerDate: findDate(firstText(doc, ['#co_docHeaderCitation'])), // a Federal Register document: "November 5, 2021"

		pubTitle: firstText(doc, ['.co_publicationLine .co_headtext']),
		headTexts: heads, // the breadcrumb of a secondary source: series, work, chapter, section
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
		var general = isCodePart(page.titleDesc) && GENERAL_CODES[m[1]], chapter = m[1] === 'MA' && /^MA\s+ST\s+(\S+)\s+\u00a7/.exec(cite);
		out = { kind: 'statute', codeNumber: chapter ? chapter[1] : '', code: general || (page.titleDesc ? stateCodeName(STATE_CODES[m[1]], page.titleDesc) : cite.replace(/\s*\u00a7.*$/, '')), section: m[2] };
	}
	else if (!t && (m = /^(\d{1,3})\s+(?:FR|Fed\.?\s*Reg\.?)\s+(\d+)/.exec(page.treatiseCite || page.cite))) {
		// a Federal Register document: ".co_cites" reads "86 FR 61402-01, 2021 WL 5130519(F.R.)"; hicite cites it as "86 Fed. Reg. 61402"
		out = { kind: 'statute', codeNumber: m[1], code: 'Fed. Reg.', section: m[2], rest: page.title.replace(/\.$/, '') };
	}
	else if (!t && (m = parseStatute(page.treatiseCite)) && m.codeNumber) {
		// no section sign in the title: "Section 100.3. A Judge Shall ..." under the citation line "22 NYCRR 100.3"
		out = m;
		var h = new RegExp('^Sec(?:tion)?\\.?\\s+' + m.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s+(.+)$').exec(page.title);
		if (h) out.rest = h[1].replace(/\.$/, '');
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
	var out = { kind: 'article', title: page.title, author: (page.author || '').replace(/\s+,\s*/g, '; '), publication: page.publication, reporter: '', volume: '', page: '', year: '', date: '' };
	var m = /^\s*(\d{1,4})\s+([A-Z][A-Za-z.&'\u2019 ]*?\.)\s+(\d{1,5})\b/.exec(page.body) || /^\s*(\d{1,4})\s+([A-Z][A-Za-z.&'\u2019 ]*?\.)\s+(\d{1,5})\b/.exec(page.body.replace(/^.*?(?=\b\d{1,4} [A-Z][a-z]*\. )/, ''));
	var c = /^(\d{1,4})\s+\S+\s+(\d{1,5})$/.exec(page.cite);
	if (m) {
		out.volume = m[1]; out.reporter = squash(m[2]); out.page = m[3];
	}
	else if (c) {
		out.volume = c[1]; out.page = c[2]; out.reporter = page.publication;
	}
	else return null;
	var after = page.body.slice(page.body.indexOf(page.publication) + page.publication.length);
	var d = new RegExp('^\\s*(' + MONTHS + ')\\.?,?\\s+(?:\\d{1,2},?\\s+)?(\\d{4})', 'i').exec(after) || /Copyright \(c\) (\d{4})/i.exec(page.body);
	if (d) {
		out.year = d[d.length - 1]; out.date = d.length > 2 ? d[1] + ' ' + d[2] : d[1];
	}
	return out;
}

// Restatement section: .co_cites "Restatement (Third) of Torts: Phys. & Emot. Harm \u00a7 34 (2010)" abbreviates, and the breadcrumb
// (.co_headtext: "Restatement of the Law - Torts", "Restatement (Third) of Torts: Liability for Physical and Emotional Harm",
// "Chapter 6. ...", "\u00a7 34 Intervening Acts ...") has the work's full title; <title> and #title name the section.
function restatementFromHeader(page) {
	if (!isRestatement(page.treatiseCite)) return null;
	var p = parseRestatement(page.treatiseCite), title = p.name, base = p.name.split(':')[0];
	for (var i = 0; i < page.headTexts.length; i++) {
		if (page.headTexts[i] === p.name || (p.name.indexOf(':') > -1 && page.headTexts[i].indexOf(base + ':') === 0)) {
			title = page.headTexts[i];
			break;
		}
	}
	return { kind: 'restatement', title: title, year: p.year, edition: p.edition,
		section: p.section && page.title.indexOf(p.section) === 0 ? page.title : p.section }; // with its heading, as the page gives it
}

// Treatise section: .co_cites "2 McCarthy on Trademarks and Unfair Competition § 18:2 (5th ed.)", .co_publicationLine
// "McCarthy on Trademarks ... Fifth Edition | September 2026 Update", .co_authorLine "J. Thomas McCarthy"
function treatiseFromHeader(page) {
	if (!page.pubTitle || !page.treatiseCite) return null;
	var m = /^(?:(\d{1,3})\s+)?(.+?)\s+\u00a7+\s*([\w:.-]+)\s*\((?:(\d+)(?:st|nd|rd|th)\s+ed\.|[^)]*)\)\s*$/.exec(page.treatiseCite);
	if (!m) return null;
	var d = new RegExp('(' + MONTHS + ')\\.?,?\\s+(\\d{4})', 'i').exec(page.pubDate);
	return { kind: 'treatise', title: page.title.replace(/^\u00a7+\s*[\w:.-]+?\.?\s+/, ''), bookTitle: m[2], volume: m[1] || '', section: m[3], edition: m[4] || '',
		date: d ? d[1] + ' ' + d[2] : (/\b(\d{4})\b/.exec(page.pubDate) || [])[1] || '', author: page.treatiseAuthor };
}

// "Effective: January 8, 2021" -> the date; a range ("[See Text Amendments] to October 20, 2025, Effective: ...") gives its last date
function effectiveDate(text) {
	var all = (text || '').match(new RegExp('(?:' + MONTHS + ')\\.?\\s+\\d{1,2},?\\s+\\d{4}', 'gi')) || [];
	return all.length ? findDate(all[all.length - 1]) : '';
}

// Session law (Historical Session Laws): .co_cites "PL 112-29, September 16, 2011, 125 Stat 284", title "LEAHY\u2013SMITH AMERICA INVENTS ACT"
function sessionLawFromHeader(page) {
	var m = /^(?:PL|Pub\.?\s*L\.?)\s+(\d+)-(\d+),\s*([A-Za-z.]+\s+\d{1,2},\s+\d{4}),\s*(\d+)\s+Stat\.?\s+(\d+)/.exec(page.treatiseCite || page.cite || '');
	if (!m || !page.title) return null;
	var name = fixCase(page.title).replace(/([\u2013-])([a-z])/g, function (x, d, c) {
		return d + c.toUpperCase();
	});
	return { kind: 'statute', codeNumber: m[4], code: 'Stat.', section: m[5], publicLawNumber: m[1] + '-' + m[2], session: m[1], rest: name, date: findDate(m[3]) };
}

function classifyWestlaw(page) {
	var sl = sessionLawFromHeader(page);
	if (sl) return { parsed: sl, extra: { title: sl.rest, date: sl.date } };
	var rs = restatementFromHeader(page);
	if (rs) return { parsed: rs, extra: {} };
	var tr = treatiseFromHeader(page);
	if (tr) return { parsed: tr, extra: {} };
	var st = statuteFromHeader(page);
	if (st) return { parsed: st, extra: { title: st.rest, date: effectiveDate(page.date) || (st.code === 'Fed. Reg.' ? page.headerDate : '') } };
	var art = articleFromHeader(page);
	return art ? { parsed: art, extra: {} } : classify(page);
}

function detectWeb(doc, url) {
	watchForChanges(doc);
	try {
		var type = detect(doc, url);
		Zotero.debug('Westlaw (legal): detectWeb -> ' + type + ' for ' + url.replace(/[?#].*$/, ''));
		if (!type) Zotero.debug('Westlaw (legal): page read as ' + JSON.stringify(readPage(doc), function (k, v) {
			return k === 'body' ? undefined : v;
		}));
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

// A link that finds the case by its citation, so it works for anyone with Westlaw access and not only through this session's document
// address (citation-phoenix's choice); '' when the case has no reporter citation
function findURL(item) {
	if (item.itemType === 'statute') {
		// a federal code or regulation section: "37 C.F.R. 42.108"
		return item.codeNumber && item.section && /^(?:U\.S\.C\.|C\.F\.R\.|NYCRR|Stat\.|Fed\. Reg\.)$/.test(item.code) // codes the find box is known to take
			? 'https://1.next.westlaw.com/Search/Results.html?query=find:' + encodeURIComponent(item.codeNumber + ' ' + (item.code === 'Fed. Reg.' ? 'FR' : item.code) + ' ' + item.section) + '#autoLogin' : '';
	}
	if (item.itemType !== 'case' || !item.reporter || !item.reporterVolume || !item.firstPage) return '';
	return 'https://1.next.westlaw.com/Search/Results.html?query=find:' + encodeURIComponent(item.reporterVolume + ' ' + item.reporter + ' ' + item.firstPage) + '#autoLogin';
}

// The page number (from the star pagination, "*340") in force where a highlight starts. citation-phoenix's getPageNumber, except that
// it returns the last marker when the highlight follows all of them (it returned nothing there, and the note read "[undefined]").
function highlightPage(el, doc) {
	var marks = doc.getElementsByClassName('co_starPage'), page = '', i, c;
	for (i = 0; i < marks.length; i++) {
		if (marks[i].textContent.indexOf('**') > -1) continue; // "**" marks a parallel reporter's pagination
		c = marks[i].compareDocumentPosition(el);
		if ((c & 4) && !(c & 16)) page = squash(marks[i].textContent); // the highlight follows this marker
		else return page;
	}
	return page;
}

// The passages you highlighted on Westlaw (class co_hl; one highlight may span several elements sharing a data-annotationid), each
// with the page it starts on, as a note: <blockquote>text [page]</blockquote>. citation-phoenix's getAnnotations.
function highlightsNote(doc) {
	var marks = doc.getElementsByClassName('co_hl'), quotes = [], text = '', page = '', i, id, next;
	for (i = 0; i < marks.length; i++) {
		id = marks[i].getAttribute('data-annotationid');
		next = marks[i + 1] ? marks[i + 1].getAttribute('data-annotationid') : '';
		text += marks[i].textContent;
		page = page || highlightPage(marks[i], doc);
		if (id !== next) {
			quotes.push('<p><blockquote>' + squash(text) + ' [' + page + ']</blockquote></p>');
			text = '';
			page = '';
		}
	}
	return quotes.join('');
}

async function scrape(doc, url) {
	var c = classifyWestlaw(readPage(doc));
	if (!c) throw new Error('Westlaw: could not read a citation from this page');
	var item = buildItem(c.parsed, c.extra);
	item.url = findURL(item) || url.replace(/[?#].*$/, '');
	item.libraryCatalog = 'Westlaw';
	var highlights = item.itemType === 'case' ? highlightsNote(doc) : '';
	if (highlights) item.notes.push({ note: highlights, tags: ['note'] });
	addSnapshot(item, doc);
	item.complete();
}
