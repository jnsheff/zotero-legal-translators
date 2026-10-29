{
	"translatorID": "c71e9a52-6d3b-4f08-b5a4-1e83f20d7c96",
	"label": "LegiScan (legal)",
	"creator": "jnsheff",
	"target": "^https?://(?:www\\.)?legiscan\\.com/[A-Z]{2}/text/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 90,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-10-29 18:15:15"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 jnsheff

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

// ---- shared legal-citation parsing (identical in both translators; edit src/shared.js) ----

var MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
var DATE_RE = new RegExp('\\b(' + MONTHS + ')\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b', 'i');

function squash(s) {
	return (s || '').replace(/[\u200b-\u200f\u2060-\u2064\ufeff]/g, '').replace(/[\u00a0\s]+/g, ' ').trim();
}

// Trim Westlaw/Lexis all-caps names ("FEIST PUBLICATIONS, INC. v. ...") into title case
function fixCase(s) {
	s = squash(s);
	var letters = s.replace(/[^A-Za-z]/g, ''), upper = s.replace(/[^A-Z]/g, '');
	if (letters.length > 3 && upper.length / letters.length > 0.8) {
		s = ZU.capitalizeTitle(s.toLowerCase(), true).replace(/\s[Vv]\.?\s/g, ' v. ').replace(/\bMc([a-z])/g, function (x, c) {
			return 'Mc' + c.toUpperCase();
		});
	}
	return s;
}

// state or territory -> [postal code, circuit], as in citation-phoenix's case-jurisdiction map
var JURIS_STATES = { Alabama: ['al', '11'], Alaska: ['ak', '9'], Arizona: ['az', '9'], Arkansas: ['ar', '8'], California: ['ca', '9'], Colorado: ['co', '10'],
	Connecticut: ['ct', '2'], Delaware: ['de', '3'], 'District of Columbia': ['dc', '0'], Florida: ['fl', '11'], Georgia: ['ga', '11'], Hawaii: ['hi', '9'],
	Idaho: ['id', '9'], Illinois: ['il', '7'], Indiana: ['in', '7'], Iowa: ['ia', '8'], Kansas: ['ks', '10'], Kentucky: ['ky', '6'], Louisiana: ['la', '5'],
	Maine: ['me', '1'], Maryland: ['md', '4'], Massachusetts: ['ma', '1'], Michigan: ['mi', '6'], Minnesota: ['mn', '8'], Mississippi: ['ms', '5'],
	Missouri: ['mo', '8'], Montana: ['mt', '9'], Nebraska: ['ne', '8'], Nevada: ['nv', '9'], 'New Hampshire': ['nh', '1'], 'New Jersey': ['nj', '3'],
	'New Mexico': ['nm', '10'], 'New York': ['ny', '2'], 'North Carolina': ['nc', '4'], 'North Dakota': ['nd', '8'], Ohio: ['oh', '6'], Oklahoma: ['ok', '10'],
	Oregon: ['or', '9'], Pennsylvania: ['pa', '3'], 'Puerto Rico': ['pr', '1'], 'Rhode Island': ['ri', '1'], 'South Carolina': ['sc', '4'],
	'South Dakota': ['sd', '8'], Tennessee: ['tn', '6'], Texas: ['tx', '5'], Utah: ['ut', '10'], Vermont: ['vt', '2'], Virginia: ['va', '4'],
	Washington: ['wa', '9'], 'West Virginia': ['wv', '4'], Wisconsin: ['wi', '7'], Wyoming: ['wy', '10'], Guam: ['gu', '9'], 'Virgin Islands': ['vi', '3'],
	'U.S. Virgin Islands': ['vi', '3'], 'Northern Mariana Islands': ['mp', '9'] };
// The key with the names citation-phoenix shows beside it: "005us:c2United States|US|Second Circuit"
function encodeJurisdiction(key) {
	var p = key.split(':'), names = ['United States', 'US'], c = /^c(\d*)$/.exec(p[1] || ''), name, n;
	var ORD = { '': 'Federal', 0: 'D.C.', 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth', 9: 'Ninth', 10: 'Tenth', 11: 'Eleventh' };
	if (c) names.push(ORD[c[1]] + ' Circuit');
	if (p[2] || (p[1] && !c)) {
		var d = /^([a-z]{2})(?:\.([nsewmc]?d))?$/.exec(p[2] || p[1]), code = d ? d[1] : '';
		for (name in JURIS_STATES) {
			if (JURIS_STATES[name][0] === code && name !== 'Virgin Islands') n = name;
		}
		if (n) names.push(d[2] ? (d[2].length > 1 ? d[2].charAt(0).toUpperCase() + '.D. ' : 'D. ') + n : n);
	}
	else if (p[1] === 'dc.d') names.push('D. District of Columbia');
	var label = names.join('|');
	return ('00' + key.length).slice(-3) + key + label;
}

var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "Oct", "Sept." -> "October", "September"
function fullMonth(m) {
	var i = MONTH_NAMES.map(function (n) {
		return n.slice(0, 3).toLowerCase();
	}).indexOf(m.slice(0, 3).toLowerCase());
	return i < 0 ? m : MONTH_NAMES[i];
}
function findDate(text) {
	var m = DATE_RE.exec(text || '');
	return m ? fullMonth(m[1]) + ' ' + m[2] + ', ' + m[3] : '';
}
// Save the page itself with the item
function addSnapshot(item, doc) {
	item.attachments.push({ title: 'Snapshot', document: doc });
}


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


/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
