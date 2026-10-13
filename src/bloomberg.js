/*SHARED*/

// Bloomberg Law court dockets (www.bloomberglaw.com/product/blaw/document/...): a document from a docket (a complaint, a motion, an order)
// is saved as a Case named for the paper and the case ("Complaint: Joshi v. OpenAI Foundation"), which is how hicite cites court papers
// (\defcasedoc: "Complaint, Joshi v. OpenAI Found., No. 4:26-cv-00222 (N.D. Fla. May 10, 2026)") and how citation-phoenix files them: the court
// in Court, the docket number, the date of filing, and the jurisdiction and filing date in its Extra block. The viewer draws the PDF with PDF.js,
// so the document's own text is on the page:
//
//   h2.title-text                                  "JOSHI v OPENAI FOUNDATION et al, Docket No. 4:26-cv-00222 (N.D. Fla. May 10, 2026), Court Docket"
//   #text-layer-1 span                             the first page of the PDF: the paper's title ("COMPLAINT") and the court's footer
//                                                  "Case 4:26-cv-00222-MW-MJF" / "Document 1" / "Filed 05/10/26" / "Page 1 of 76"
//   .SidebarDocketsMultipart li                    the parts of a multi-part document: "Part 1: 1", "Part 2: Civil Cover Sheet" (the current part is not a button)

var DOCUMENT_URL = /^https?:\/\/(?:www\.)?bloomberglaw\.com\/product\/blaw\/document\/[A-Z0-9]+/;
var DOCKET_TITLE = /^(.+?),\s+Docket No\.\s+(\S+)\s+\((.+?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4})\),\s+Court Docket\s*$/;
var PAPER_TITLE = new RegExp('^\\s*((?:(?:FIRST|SECOND|THIRD|FOURTH|FIFTH)\\s+)?(?:AMENDED\\s+)?(?:(?:CLASS ACTION|VERIFIED|SUPPLEMENTAL|RESTATED)\\s+)?'
	+ '(?:COMPLAINT|ANSWER|COUNTERCLAIM|PETITION|MOTION|MEMORANDUM|ORDER|OPINION|JUDGMENT|STIPULATION|NOTICE|DECLARATION|AFFIDAVIT|BRIEF|RESPONSE|REPLY|SUMMONS|INDICTMENT)'
	+ '\\b[^.]{0,100})\\s*$');
var ENTITY_SUFFIX = /^(?:LLC|LLP|LP|PBC|PLLC|USA|NA|N\.A\.|U\.S\.|II|III|IV)$/;

// the spans of the first page's text layer, in order
function pageText(doc) {
	var spans = doc.querySelectorAll('#text-layer-1 span[role="presentation"], #text-layer-1 .textLayer > span'), out = [];
	for (var i = 0; i < spans.length; i++) {
		var t = squash(spans[i].textContent);
		if (t) out.push(t);
	}
	return out;
}

// "OPENAI FOUNDATION et al" -> "OpenAI Foundation": the PDF spells a name in mixed case somewhere ("OpenAI"); otherwise capitalize the word
function party(name, texts) {
	var mixed = {}, all = texts.join(' ').match(/[A-Za-z][A-Za-z'.&-]*/g) || [];
	all.forEach(function (w) {
		if (/[a-z]/.test(w) && /[A-Z]/.test(w.slice(1))) mixed[w.toUpperCase()] = w; // "OpenAI", "McDonald's"
	});
	return squash(name.replace(/\s+et al\.?$/i, '')).split(' ').map(function (w) {
		var core = w.replace(/[^A-Za-z.&'-]/g, '');
		if (!core || /[a-z]/.test(core)) return w; // already mixed case
		if (mixed[core]) return w.replace(core, mixed[core]);
		if (ENTITY_SUFFIX.test(core)) return w;
		return w.charAt(0) + w.slice(1).toLowerCase();
	}).join(' ');
}

function readDocket(doc, url) {
	var h = doc.querySelector('h2.title-text, .document-title-container h2') || doc.querySelector('title'), title = squash(h ? h.textContent : ''),
		m = DOCKET_TITLE.exec(title.replace(/\s+/g, ' '));
	if (!m || !doc.querySelector('#document-content.doctype-DOCKETS')) return null;
	var texts = pageText(doc), footer = {}, paper = '', i, f;
	for (i = 0; i < texts.length; i++) {
		if ((f = /^Case\s+(\S+)$/.exec(texts[i]))) footer.caseNo = f[1];
		else if ((f = /^Document\s+(\S+)$/.exec(texts[i]))) footer.document = f[1];
		else if ((f = /^Filed\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(texts[i]))) footer.filed = f;
		else if ((f = /^Page\s+\d+\s+of\s+(\d+)$/.exec(texts[i]))) footer.pages = f[1];
		else if (!paper && texts[i].length < 120 && texts[i] === texts[i].toUpperCase() && (f = PAPER_TITLE.exec(texts[i]))) paper = f[1];
	}
	// the parts of a multi-part document: the current one is not a button
	var part = null, lis = doc.querySelectorAll('.SidebarDocketsMultipart li');
	for (i = 0; i < lis.length; i++) {
		if (!lis[i].querySelector('button') && (f = /^\s*Part\s+(\d+):\s*(.*)$/.exec(squash(lis[i].textContent)))) part = { number: f[1], title: squash(f[2]) };
	}
	var sides = m[1].split(/\s+v\.?\s+/i);
	var filed = '';
	if (footer.filed) {
		var y = +footer.filed[3];
		filed = MONTH_NAMES[+footer.filed[1] - 1] + ' ' + (+footer.filed[2]) + ', ' + (y < 100 ? 2000 + y : y);
	}
	return { plaintiff: party(sides[0], texts), defendant: party(sides.slice(1).join(' v. '), texts), docket: m[2], court: m[3], date: findDate(m[4]), filed: filed, footer: footer, paper: paper, part: part,
		url: url.replace(/[?#].*$/, '') };
}

function paperName(d) {
	var p = d.part && +d.part.number > 1 ? d.part.title : d.paper;
	if (!p) return '';
	return p === p.toUpperCase() ? p.charAt(0) + p.slice(1).toLowerCase() : p;
}

// The address of the PDF: the viewer's "Open PDF in New Window" opens <document address>/download?imagename=<part number> (the first part is 1)
function pdfURL(d) {
	return d.url + '/download?imagename=' + (d.part ? d.part.number : '1');
}

function detectWeb(doc, url) {
	return DOCUMENT_URL.test(url) && readDocket(doc, url) ? 'case' : false;
}

async function doWeb(doc, url) {
	await scrape(doc, url);
}

async function scrape(doc, url) {
	var d = readDocket(doc, url);
	if (!d) throw new Error('Bloomberg Law: not a docket document');
	var paper = paperName(d), name = (paper ? paper + ': ' : '') + d.plaintiff + ' v. ' + d.defendant;
	var item = buildItem({ kind: 'case', name: name, volume: '', reporter: '', page: '', court: d.court, date: d.filed || d.date }, { docket: d.docket, court: d.court });
	item.url = d.url;
	item.libraryCatalog = 'Bloomberg Law';
	var extra = [];
	if (d.footer.document) extra.push('Docket Entry: ' + d.footer.document);
	if (d.footer.caseNo && d.footer.caseNo !== d.docket) extra.push('Case Number: ' + d.footer.caseNo);
	if (d.footer.pages) extra.push('Pages: ' + d.footer.pages);
	if (d.filed && d.date && d.filed !== d.date) extra.push('Docket Filed: ' + d.date);
	if (extra.length) item.extra = (item.extra ? item.extra + '\n' : '') + extra.join('\n');
	item.attachments.push({ title: 'Snapshot', mimeType: 'application/pdf', url: pdfURL(d) });
	item.complete();
}
