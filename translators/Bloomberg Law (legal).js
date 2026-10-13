{
	"translatorID": "5e7a2c91-3b64-4d08-a1f7-8c0e6d2b9a43",
	"label": "Bloomberg Law (legal)",
	"creator": "jnsheff",
	"target": "^https?://(?:www\\.)?bloomberglaw\\.com/product/blaw/document/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 90,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-10-13 18:29:30"
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

var STATES = { Alabama: 'Ala.', Alaska: 'Alaska', Arizona: 'Ariz.', Arkansas: 'Ark.', California: 'Cal.', Colorado: 'Colo.', Connecticut: 'Conn.',
	Delaware: 'Del.', 'District of Columbia': 'D.C.', Florida: 'Fla.', Georgia: 'Ga.', Hawaii: 'Haw.', Idaho: 'Idaho', Illinois: 'Ill.', Indiana: 'Ind.',
	Iowa: 'Iowa', Kansas: 'Kan.', Kentucky: 'Ky.', Louisiana: 'La.', Maine: 'Me.', Maryland: 'Md.', Massachusetts: 'Mass.', Michigan: 'Mich.',
	Minnesota: 'Minn.', Mississippi: 'Miss.', Missouri: 'Mo.', Montana: 'Mont.', Nebraska: 'Neb.', Nevada: 'Nev.', 'New Hampshire': 'N.H.',
	'New Jersey': 'N.J.', 'New Mexico': 'N.M.', 'New York': 'N.Y.', 'North Carolina': 'N.C.', 'North Dakota': 'N.D.', Ohio: 'Ohio', Oklahoma: 'Okla.',
	Oregon: 'Or.', Pennsylvania: 'Pa.', 'Rhode Island': 'R.I.', 'South Carolina': 'S.C.', 'South Dakota': 'S.D.', Tennessee: 'Tenn.', Texas: 'Tex.',
	Utah: 'Utah', Vermont: 'Vt.', Virginia: 'Va.', Washington: 'Wash.', 'West Virginia': 'W. Va.', Wisconsin: 'Wis.', Wyoming: 'Wyo.',
	'Puerto Rico': 'P.R.', Guam: 'Guam' };
var CIRCUITS = { First: '1st', Second: '2d', Third: '3d', Fourth: '4th', Fifth: '5th', Sixth: '6th', Seventh: '7th', Eighth: '8th', Ninth: '9th',
	Tenth: '10th', Eleventh: '11th', 'District of Columbia': 'D.C.', Federal: 'Fed.' };

// A court name as the sites print it -> its Bluebook abbreviation; unrecognised names are returned as given.
//   "United States Court of Appeals, Fifth Circuit." -> "5th Cir."    "United States District Court, E.D. Texas." -> "E.D. Tex."
function abbrevCourt(name) {
	var n = squash(name).replace(/[.,;\s]+$/, ''), m, div, st;
	if (/^(?:the )?(?:United States|U\.S\.) Supreme Court$|^Supreme Court of the United States$/i.test(n)) return 'U.S.';
	if ((m = /Court of Appeals(?:,| for the)? (?:the )?(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|District of Columbia|Federal) Circuit/i.exec(n))) {
		return CIRCUITS[m[1].replace(/^./, function (c) {
			return c.toUpperCase();
		})] + ' Cir.';
	}
	// Westlaw: "United States District Court, E.D. Texas"; Lexis: "United States District Court for the Eastern District of Texas"
	if ((m = /District Court,? (?:for the )?((?:[NSEWMC]\.\s?)+D\.|D\.)\s*(.+)$/.exec(n))) {
		div = m[1].replace(/\s/g, '');
		st = STATES[squash(m[2]).replace(/^(?:of )?(?:the State of )?/i, '')];
	}
	else if ((m = /District Court,? (?:for the )?(?:(Northern|Southern|Eastern|Western|Middle|Central) )?District of (.+)$/i.exec(n))) {
		div = (m[1] ? m[1].charAt(0).toUpperCase() + '.D.' : 'D.');
		st = STATES[squash(m[2]).replace(/^the State of /i, '')] || STATES['District of ' + squash(m[2])];
	}
	if (div && st) return ((st === 'N.Y.' && div !== 'D.') || st === 'D.C.' ? div + st : div + ' ' + st);
	if ((m = /^Supreme Court of (?:the State of )?(.+)$/i.exec(n)) && STATES[m[1]] && m[1] !== 'New York') return STATES[m[1]];
	// unrecognised: keep an abbreviation such as "2d Cir." as it is, drop the sentence period after a full name
	return squash(name).split(' ').length > 3 ? n : squash(name);
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
var JURIS_CIRCUIT = { federal: 'federal', 'district of columbia': '0', 'd.c.': '0', first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
	seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11' };
var JURIS_PART = { Northern: 'n', Southern: 's', Eastern: 'e', Western: 'w', Middle: 'm', Central: 'c' };

// citation-phoenix's _lookupStateInfo: a state name (or "D.C.") -> [code, circuit]
function jurisState(raw) {
	var name = squash(raw).replace(/\.$/, '');
	if (!name) return null;
	var synonyms = { 'D.C.': 'District of Columbia', DC: 'District of Columbia', 'Virgin Islands': 'U.S. Virgin Islands' };
	return JURIS_STATES[name] || JURIS_STATES[synonyms[name]] || null;
}

// a Bluebook state abbreviation ("N.Y.", "Tex.", "W. Va.") -> [code, circuit]
function jurisStateByAbbr(raw) {
	var k = squash(raw).replace(/[.\s]/g, '').toLowerCase(), name;
	for (name in STATES) {
		if (STATES[name].replace(/[.\s]/g, '').toLowerCase() === k) return JURIS_STATES[name] || null;
	}
	return null;
}

// district court of a state: "us:c4:nc.ed"; D.D.C. is "us:dc.d"; a state with no circuit has none in the key
function jurisDistrict(part, state) {
	var token = (part ? part.toLowerCase() : '') + 'd';
	if (state[0] === 'dc') return 'us:dc.d';
	return state[1] ? 'us:c' + state[1] + ':' + state[0] + '.' + token : 'us:' + state[0] + '.' + token;
}

// citation-phoenix's _mapFederalDistrict: the text after "United States District Court,": "N.D. Georgia", "D. Maine"
function jurisFederalDistrict(text) {
	var t = squash(text), m = /^(N|S|E|W|M|C)\.D\.\s+(.+)$/i.exec(t), part = '', state;
	if (m) part = m[1].toUpperCase();
	else if (!(m = /^D\.\s+(.+)$/i.exec(t))) return '';
	state = jurisState(m[m.length - 1]);
	return state ? jurisDistrict(part, state) : '';
}

// citation-phoenix's _mapJurisdiction, rule for rule, on a court line with its final period removed: the federal rules
function jurisPhoenixFederal(line) {
	var m, token;
	if (/^Supreme Court of the United States$/i.test(line)) return 'us';
	if ((m = /^United States Court of Appeals,\s+(.+?)\s+Circuit$/i.exec(line))) {
		token = JURIS_CIRCUIT[m[1].trim().toLowerCase()];
		return token === 'federal' ? 'us:c' : token ? 'us:c' + token : '';
	}
	if (/\b(fed|federal)\.?\s+cir(cuit)?\.?\b/i.test(line)) return 'us:c';
	if ((m = /\b(1|2|3|4|5|6|7|8|9|10|11)(st|nd|rd|th)?\s+cir(cuit)?\.?\b/i.exec(line))) return 'us:c' + m[1];
	if (/\b(d\.c\.|district of columbia)\s+cir(cuit)?\.?\b/i.test(line)) return 'us:c0';
	if ((m = /^United States District Court,\s+(.+)$/i.exec(line))) return jurisFederalDistrict(m[1]);
	return '';
}

// its last rule: a state or territory named anywhere in the line (the repair: longest name first, so West Virginia is not Virginia)
function jurisPhoenixState(line) {
	var names = [], name, i;
	for (name in JURIS_STATES) names.push(name);
	names.sort(function (a, b) {
		return b.length - a.length;
	});
	for (i = 0; i < names.length; i++) {
		if (new RegExp('(?:^|\\s|,)' + names[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\s|[.,])', 'i').test(line)) return 'us:' + JURIS_STATES[names[i]][0];
	}
	return '';
}

// Added: the district and bankruptcy court wordings the mapper misses
//   Lexis "United States District Court for the Eastern District of Texas", "... for the District of Maine", Westlaw
//   "United States Bankruptcy Court, S.D. New York"
function jurisLongDistrict(line) {
	var m = /^United States (?:District|Bankruptcy) Court,?\s+(?:for the\s+)?(?:(Northern|Southern|Eastern|Western|Middle|Central)\s+)?District of (?:the State of )?(.+)$/i.exec(line), state;
	if (m && (state = jurisState(m[2]) || jurisState('District of ' + m[2]))) return jurisDistrict(m[1] ? JURIS_PART[m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()] : '', state);
	if ((m = /^United States Bankruptcy Court,\s+(.+)$/i.exec(line))) return jurisFederalDistrict(m[1]);
	return '';
}

// Added: a Bluebook court ("2d Cir.", "S.D.N.Y.", "N.D. Cal.", "D.D.C.", "Tex.", "N.Y. App. Div.") -> key
function jurisBluebook(abbr) {
	var a = squash(abbr).replace(/\.$/, ''), m, state, tokens, n;
	if (a === 'U.S') return 'us';
	if (a === 'Fed. Cir') return 'us:c';
	if (a === 'D.C. Cir') return 'us:c0';
	if ((m = /^(\d{1,2})(?:st|nd|rd|th|d) Cir$/.exec(a))) return 'us:c' + m[1];
	if ((m = /^(?:([NSEWMC])\.\s?)?D\.\s?(.+)$/.exec(a)) && (state = jurisStateByAbbr(m[2]))) return jurisDistrict(m[1] || '', state);
	tokens = a.split(' ');
	for (n = Math.min(3, tokens.length); n > 0; n--) {
		if ((state = jurisStateByAbbr(tokens.slice(0, n).join(' ')))) return 'us:' + state[0];
	}
	return '';
}

// A court as the page prints it (or as a citation abbreviates it) -> jurisdiction key, or '' when it cannot be told
function mapJurisdiction(source) {
	var line = squash(source).replace(/\.$/, '').replace(/,\s*[a-zA-Z]+\s*Division\.?$/i, '');
	if (!line) return '';
	// the district wordings come before its state rule, which would take "... District of Texas" for the Texas courts
	return jurisPhoenixFederal(line) || jurisLongDistrict(line) || jurisPhoenixState(line) || jurisBluebook(abbrevCourt(line));
}

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

// Marks the item as citation-phoenix's "restatement" type; hicite exports it as a model code
var RESTATEMENT_EXTRA = 'mlzsync1:{"xtype":"restatement"}';

// A Zotero item from a parsed citation; `extra` = fields read from the page that fill any gaps.
function buildItem(parsed, extra) {
	extra = extra || {};
	var item, court, date;
	if (parsed.kind === 'statute') {
		item = new Zotero.Item('statute');
		item.nameOfAct = extra.title || (parsed.rest && !/^\(/.test(parsed.rest) ? parsed.rest.replace(/\s*\([^)]*\d{4}\)\s*$/, '') : '');
		item.code = parsed.code;
		item.codeNumber = parsed.codeNumber;
		item.section = parsed.section;
		if (parsed.publicLawNumber) item.publicLawNumber = parsed.publicLawNumber;
		if (parsed.session) item.session = parsed.session;
		if (extra.date) item.dateEnacted = extra.date;
		return item;
	}
	if (parsed.kind === 'restatement') {
		item = new Zotero.Item('book');
		item.title = parsed.title;
		item.creators.push({ lastName: 'American Law Institute', creatorType: 'author', fieldMode: 1 });
		item.publisher = 'American Law Institute';
		if (parsed.year) item.date = parsed.year;
		if (parsed.edition) item.edition = parsed.edition; // a draft's name: "Tentative Draft No. 2"
		item.extra = RESTATEMENT_EXTRA;
		if (parsed.section) item.notes.push({ note: 'Section: ' + parsed.section });
		return item;
	}
	if (parsed.kind === 'treatise') {
		item = new Zotero.Item('bookSection');
		item.title = parsed.title;
		item.bookTitle = parsed.bookTitle;
		item.volume = parsed.volume;
		item.extra = 'Section: ' + parsed.section; // Zotero has no section field for book sections
		if (parsed.edition) item.edition = parsed.edition;
		if (parsed.date) item.date = parsed.date;
		if (parsed.publisher) item.publisher = parsed.publisher;
		(parsed.author || '').split(/\s*;\s*|\s+(?:&|and)\s+/).forEach(function (a) {
			if (squash(a)) item.creators.push(ZU.cleanAuthor(fixCase(a), 'bookAuthor'));
		});
		return item;
	}
	if (parsed.kind === 'article') {
		item = new Zotero.Item('journalArticle');
		item.title = fixCase(parsed.title.replace(/^(?:ARTICLE|RESPONSE|ESSAY|COMMENT|NOTE|SYMPOSIUM|TRIBUTE|BOOK REVIEW|FOREWORD|REPLY|COMMENTARY)S?:\s*/i, ''));
		if (parsed.author) {
			parsed.author.split(/\s*;\s*|\s+(?:&|and)\s+/).forEach(function (a) {
				if (squash(a)) item.creators.push(ZU.cleanAuthor(fixCase(a), 'author'));
			});
		}
		item.publicationTitle = parsed.publication || parsed.reporter;
		if (parsed.publication) item.journalAbbreviation = parsed.reporter;
		item.volume = parsed.volume;
		item.pages = parsed.page;
		item.date = parsed.date || parsed.year;
		return item;
	}
	item = new Zotero.Item('case');
	item.caseName = fixCase(parsed.name);
	court = abbrevCourt(parsed.court || extra.court || '');
	item.court = court;
	item.reporter = parsed.reporter;
	item.reporterVolume = parsed.volume;
	item.firstPage = parsed.page;
	date = parsed.date || extra.date || parsed.year || '';
	item.dateDecided = extra.date && /\d{4}/.test(extra.date) && extra.date.length > (parsed.date || '').length ? extra.date : date;
	if (extra.docket) item.docketNumber = extra.docket;
	// citation-phoenix's Extra block: the jurisdiction (worked out from the court as the page prints it) and the filing date,
	// which its styles read as "submitted"
	var fields = {}, jurisdiction = mapJurisdiction(extra.court) || mapJurisdiction(parsed.court) || mapJurisdiction(court);
	if (jurisdiction) fields.jurisdiction = encodeJurisdiction(jurisdiction);
	if (item.dateDecided) fields.filingDate = item.dateDecided;
	if (jurisdiction || item.dateDecided) item.extra = 'mlzsync1:' + JSON.stringify({ extrafields: fields });
	return item;
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
		if (!lis[i].querySelector('button') && (f = /^\s*Part\s+(\d+):\s*(.*)$/.exec(squash(lis[i].textContent)))) {
			part = { number: f[1], title: squash(f[2]).replace(/^(.+?)\s+\1$/, '$1') }; // the list repeats some titles: "Civil Cover Sheet Civil Cover Sheet"
			if (/^\d*$/.test(part.title)) part.title = ''; // Part 1 is listed by its number alone
		}
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
	var p = d.part && +d.part.number > 1 && d.part.title ? d.part.title : d.paper;
	if (!p) return '';
	return p === p.toUpperCase() ? p.charAt(0) + p.slice(1).toLowerCase() : p;
}

// The address of the PDF: the viewer's "Open PDF in New Window" opens <document address>/download?imagename=<part number> (the first part is 1)
function pdfURL(d) {
	return d.url + '/download?imagename=' + (d.part ? d.part.number : '1');
}

// The site is a single-page application: the document is drawn after the page has loaded, and replaced when you move to another document, so ask
// the connector to run detection again whenever the page changes (every time: it allows one observer and drops it after the first change).
function watchForChanges(doc) {
	try {
		if (doc.body && typeof Z !== 'undefined' && Z.monitorDOMChanges) Z.monitorDOMChanges(doc.body, { childList: true, subtree: true });
	}
	catch (e) {
		Zotero.debug('Bloomberg Law (legal): monitorDOMChanges: ' + e);
	}
}

function detectWeb(doc, url) {
	if (!DOCUMENT_URL.test(url)) return false;
	watchForChanges(doc);
	var d = readDocket(doc, url);
	Zotero.debug('Bloomberg Law (legal): detectWeb -> ' + (d ? 'case' : 'false (no docket title or viewer yet: title "' + squash(doc.title) + '", viewer ' + !!doc.querySelector('#document-content') + ')'));
	return d ? 'case' : false;
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
	if (d.part) extra.push('Part: ' + d.part.number + (d.part.title ? ': ' + d.part.title : '')); // a multi-part document: the part showing and its title
	if (d.footer.pages) extra.push('Pages: ' + d.footer.pages);
	if (d.filed && d.date && d.filed !== d.date) extra.push('Docket Filed: ' + d.date);
	if (extra.length) item.extra = (item.extra ? item.extra + '\n' : '') + extra.join('\n');
	item.attachments.push({ title: 'Snapshot', mimeType: 'application/pdf', url: pdfURL(d) }); // only the part showing: another part is saved from its own page
	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
