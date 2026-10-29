/*SHARED*/

// LegiScan (legiscan.com): a state bill-text page, /CA/text/SB942/id/3021807, shows one version of the text. The version on the page is
// what is saved, as a Statute for a session law (no federal: /US/ pages are left to the other translators):
//   * an enrolled or chaptered version is the enacted law: Name of Act = the bill title, Code = the state's session-law reporter
//     ("Cal. Stat."), Code Number = the year, Public Law Number = "ch. 291" (or the bill, "S.B. 24-024", when the page gives no chapter),
//     Date Enacted = the date the governor approved it. The bill's status is not recorded: it is law.
//   * any other version (introduced, amended, engrossed ...) is a pending bill: Public Law Number = the bill ("S.B. 1106"), Date Enacted =
//     the date of this version, and the status in Extra, with the version.
// Extra also keeps the bill and the version; the text itself is the snapshot (the PDF when the page embeds one).
//
//   <title>                                  "Bill Text: CA SB942 | 2023-2024 | Regular Session | Chaptered | LegiScan"
//   <b>Bill Title:</b> / <b>Status:</b> / <b>Download:</b>   labelled lines under the tabs; ul.tabs.primary li.active is the version
//   .billtext                                the text (absent when the page embeds a PDF, as Colorado's does)

var TEXT_URL = /^https?:\/\/(?:www\.)?legiscan\.com\/([A-Z]{2})\/text\/([A-Za-z]+\d+)\/id\/(\d+)/;
var ENACTED_VERSION = /^(?:Enrolled|Chaptered)$/i;

// Bluebook T1 session-law reporters
var SESSION_LAW_REPORTERS = { AL: 'Ala. Acts', AK: 'Alaska Sess. Laws', AZ: 'Ariz. Sess. Laws', AR: 'Ark. Acts', CA: 'Cal. Stat.', CO: 'Colo. Sess. Laws',
	CT: 'Conn. Acts', DE: 'Del. Laws', FL: 'Fla. Laws', GA: 'Ga. Laws', HI: 'Haw. Sess. Laws', ID: 'Idaho Sess. Laws', IL: 'Ill. Laws', IN: 'Ind. Acts',
	IA: 'Iowa Acts', KS: 'Kan. Sess. Laws', KY: 'Ky. Acts', LA: 'La. Acts', ME: 'Me. Laws', MD: 'Md. Laws', MA: 'Mass. Acts', MI: 'Mich. Pub. Acts',
	MN: 'Minn. Laws', MS: 'Miss. Laws', MO: 'Mo. Laws', MT: 'Mont. Laws', NE: 'Neb. Laws', NV: 'Nev. Stat.', NH: 'N.H. Laws', NJ: 'N.J. Laws',
	NM: 'N.M. Laws', NY: 'N.Y. Laws', NC: 'N.C. Sess. Laws', ND: 'N.D. Laws', OH: 'Ohio Laws', OK: 'Okla. Sess. Laws', OR: 'Or. Laws', PA: 'Pa. Laws',
	RI: 'R.I. Pub. Laws', SC: 'S.C. Acts', SD: 'S.D. Sess. Laws', TN: 'Tenn. Pub. Acts', TX: 'Tex. Gen. Laws', UT: 'Utah Laws', VT: 'Vt. Acts & Resolves',
	VA: 'Va. Acts', WA: 'Wash. Sess. Laws', WV: 'W. Va. Acts', WI: 'Wis. Laws', WY: 'Wyo. Sess. Laws' };

// "SB" -> "S.B."
var BILL_TYPES = { SB: 'S.B.', AB: 'A.B.', HB: 'H.B.', SF: 'S.F.', HF: 'H.F.', LB: 'L.B.', LR: 'L.R.', SJR: 'S.J. Res.', HJR: 'H.J. Res.', AJR: 'A.J. Res.',
	SCR: 'S. Con. Res.', HCR: 'H. Con. Res.', ACR: 'A. Con. Res.', SR: 'S. Res.', HR: 'H. Res.', AR: 'A. Res.', SJM: 'S.J. Mem.', HJM: 'H.J. Mem.' };

// the text after a <b>Label:</b>, up to the next line break (without the "[SB942 Detail]" link after the status)
function labelled(doc, label) {
	var bs = doc.querySelectorAll('b'), out = [];
	for (var i = 0; i < bs.length; i++) {
		if (squash(bs[i].textContent) !== label) continue;
		for (var n = bs[i].nextSibling; n && n.nodeName !== 'BR'; n = n.nextSibling) {
			if (n.nodeName !== 'A' || !/Detail\]$/.test(squash(n.textContent))) out.push(n.textContent);
		}
		return squash(out.join(' '));
	}
	return '';
}

// "SB942" -> "S.B. 942"; Colorado numbers its bills by year: "SB024" in 2024 is "S.B. 24-024"
function designation(state, bill, year) {
	var m = /^([A-Za-z]+)0*(\d+)$/.exec(bill), type, num;
	if (!m) return bill;
	type = BILL_TYPES[m[1].toUpperCase()] || m[1].toUpperCase().split('').join('.') + '.';
	num = m[2];
	if (state === 'CO' && year && /^0\d\d$/.test(/(\d+)$/.exec(bill)[1])) num = String(year).slice(-2) + '-' + /(\d+)$/.exec(bill)[1];
	return type + ' ' + num;
}

function isoToDate(s) {
	var m = /(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
	return m ? MONTH_NAMES[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : '';
}

function readBill(doc, url) {
	var u = TEXT_URL.exec(url.replace(/[?#].*$/, '')), t = /^Bill Text:\s*([A-Z]{2})\s+(\S+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(?:([^|]+?)\s*\|\s*)?LegiScan/.exec(squash(doc.title));
	if (!u || !t || !SESSION_LAW_REPORTERS[u[1]]) return null; // only the states
	var active = doc.querySelector('ul.tabs.primary li.active'), version = squash(active ? active.textContent : '') || t[5] || '',
		status = /^\((\w[\w ]*)\)\s*(\d{4}-\d{2}-\d{2})\s*-\s*(.*)$/.exec(labelled(doc, 'Status:')), text = doc.querySelector('.billtext'),
		desc = (doc.querySelector('meta[property="og:description"]') || {}).content || '', dl = null, bs = doc.querySelectorAll('b');
	for (var i = 0; i < bs.length && !dl; i++) {
		var a = squash(bs[i].textContent) === 'Download:' ? bs[i].nextElementSibling : null; // the .pdf of a text the page embeds as a PDF
		if (a && a.nodeName === 'A' && /\.pdf$/i.test(a.href)) dl = a.href;
	}
	var body = squash(text ? text.textContent : ''), approved = new RegExp('Approved by\\s+(?:the\\s+)?Governor\\s+((?:' + MONTHS + ')\\.?\\s+\\d{1,2},\\s+\\d{4})').exec(body.slice(0, 4000)),
		action = status ? squash(status[3]) : '', ch = /\bChapter\s+(\d+)\b/.exec(action) || /^\s*CHAPTER\s+(\d+)\b/.exec(squash((doc.querySelector('#chap_num_title_chap') || {}).textContent)),
		statutes = /Statutes of\s+(\d{4})/.exec(action);
	return { state: u[1], bill: u[2], session: t[3], sessionType: t[4], version: version, enacted: ENACTED_VERSION.test(version), title: labelled(doc, 'Bill Title:').replace(/\.$/, ''),
		statusWord: status ? status[1] : '', statusDate: status ? status[2] : '', action: action, chapter: ch ? ch[1] : '', statutesYear: statutes ? statutes[1] : '',
		approved: approved ? findDate(approved[1]) : '', versionDate: isoToDate(desc), hasText: body.length > 300, pdf: dl, url: (TEXT_URL.exec(url) ? url.replace(/[?#].*$/, '') : url) };
}

function detectWeb(doc, url) {
	return readBill(doc, url) ? 'statute' : false;
}

async function doWeb(doc, url) {
	await scrape(doc, url);
}

async function scrape(doc, url) {
	var b = readBill(doc, url);
	if (!b) throw new Error('LegiScan: not a state bill text');
	var item = new Zotero.Item('statute'), year = b.statutesYear || (b.enacted ? (b.approved || isoToDate(b.statusDate)).slice(-4) : (b.versionDate || isoToDate(b.statusDate)).slice(-4)),
		bill = designation(b.state, b.bill, /^(\d{4})/.exec(b.session)[1]), extra = [];
	item.nameOfAct = fixCase(b.title);
	item.code = SESSION_LAW_REPORTERS[b.state];
	item.codeNumber = year;
	item.publicLawNumber = b.enacted && b.chapter ? 'ch. ' + b.chapter : bill;
	item.session = b.session + ' ' + b.sessionType;
	item.dateEnacted = b.enacted ? b.approved || (/signed|approved|chaptered/i.test(b.action) ? isoToDate(b.statusDate) : '') : b.versionDate;
	item.url = b.url;
	item.libraryCatalog = 'LegiScan';
	// citation-phoenix's jurisdiction
	item.extra = 'mlzsync1:' + JSON.stringify({ extrafields: { jurisdiction: encodeJurisdiction('us:' + b.state.toLowerCase()) } });
	extra.push('Bill: ' + bill);
	if (b.version) extra.push('Version: ' + b.version);
	if (!b.enacted) extra.push('Status: ' + (b.statusWord ? b.statusWord + ' ' : '') + isoToDate(b.statusDate) + (b.action ? ': ' + b.action : ''));
	item.extra += '\n' + extra.join('\n');
	if (!b.hasText && b.pdf) item.attachments.push({ title: 'Snapshot', mimeType: 'application/pdf', url: b.pdf });
	else addSnapshot(item, doc);
	item.complete();
}
