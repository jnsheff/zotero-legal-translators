{
	"translatorID": "4a07416a-1dde-4a8e-b9a1-7aa69007af19",
	"label": "Lexis+ (legal)",
	"creator": "jnsheff",
	"target": "^https?://(?:plus|advance)\\.lexis\\.com/",
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

// Strip the site's suffix from a page title ("... - Westlaw", "... | Lexis+")
function cleanTitle(s) {
	return squash(s).replace(/\s*[-|\u2013\u2014]\s*(Westlaw(?: Edge| Next)?|Lexis\+?(?: Advance)?|Lexis(?:Nexis)?|Thomson Reuters)\b.*$/i, '');
}

// "S.D.N.Y. Jan. 1, 2023" / "9th Cir. 2001" / "1991" -> { court, date, year }
function parseParen(p) {
	p = squash(p);
	var out = { court: '', date: '', year: '' };
	var m = DATE_RE.exec(p);
	if (m) {
		out.date = m[1] + ' ' + m[2] + ', ' + m[3];
		out.year = m[3];
		out.court = squash(p.replace(m[0], ''));
	}
	else if ((m = /\b(\d{4})\b\s*$/.exec(p))) {
		out.year = m[1];
		out.date = m[1];
		out.court = squash(p.slice(0, m.index));
	}
	else {
		out.court = p;
	}
	out.court = out.court.replace(/[,\s]+$/, '');
	return out;
}

var NOT_A_CASE_RE = /\b(?:L\.? ?Rev|L\.? ?J\b|Law Review|Law Journal|Rev\.|Q\.|Stud\.|Pol'y|J\.)/;

// A full citation as a Bluebook string. Returns null if it is not a case or article citation.
//   Name v. Name, 499 U.S. 340, 345 (1991)
//   Name v. Name, 2023 WL 123456, at *3 (S.D.N.Y. Jan. 1, 2023)
//   Name v. Name, 2023 U.S. Dist. LEXIS 1234 (D. Del. Jan. 1, 2023)
//   Author, Title, 102 Harv. L. Rev. 1, 5 (1989)
function parseCitation(text) {
	text = squash(text);
	var m, out;

	// unpublished: WL and LEXIS numbers, "2023 WL 123456"
	m = /^(.+?),?\s+(\d{4})\s+((?:WL)|(?:[A-Z][A-Za-z.]*(?: [A-Z][A-Za-z.]*)*? LEXIS))\s+(\d+)(?:,?\s*at\s*\*+\s*[\d\-\u2013, ]+)?\s*\(([^)]*)\)/.exec(text);
	if (m) {
		var pp = parseParen(m[5]);
		return { kind: 'case', name: m[1].replace(/,$/, ''), volume: m[2], reporter: m[3], page: m[4], court: pp.court, date: pp.date, year: pp.year || m[2] };
	}

	// reported: volume reporter page [, pinpoint] (court year)
	m = /^(.+?),?\s+(\d{1,4})\s+([A-Z][A-Za-z0-9.'&\u2019 ]*?)\s+(\d{1,5})(?:,\s*(?:at\s*)?\*?[\d\-\u2013*n, ]+)?\s*\(([^)]*\d{4}[^)]*)\)/.exec(text);
	if (m && /[.']/.test(m[3])) {
		out = parseParen(m[5]);
		out.volume = m[2];
		out.reporter = squash(m[3]);
		out.page = m[4];
		out.name = m[1].replace(/,$/, '');
		var isCase = /\bv\.? |^In re |^Ex parte |^Matter of |^United States\b|^State\b|^People\b/.test(out.name);
		if (!isCase && NOT_A_CASE_RE.test(out.reporter)) {
			out.kind = 'article';
			out.author = '';
			var t = /^((?:[A-Z][\w.'\u2019-]+(?: [A-Z][\w.'\u2019-]*){0,3})(?: (?:&|and) [A-Z][\w.'\u2019-]+(?: [A-Z][\w.'\u2019-]*){0,3})*),\s+(.+)$/.exec(out.name);
			if (t) {
				out.author = t[1]; out.title = t[2];
			}
			else out.title = out.name;
		}
		else out.kind = 'case';
		return out;
	}
	return null;
}

// U.S. Code as the sites print it (USC, USCA, USCS, U.S.C.A., U.S.C.S.) -> "U.S.C."; CFR -> "C.F.R."
function normCode(code) {
	code = squash(code);
	if (/^U\.?S\.?C\.?[AS]?\.?$/i.test(code)) return 'U.S.C.';
	if (/^C\.?F\.?R\.?$/i.test(code)) return 'C.F.R.';
	return code;
}

// Statutes and regulations
//   47 U.S.C.A. \u00a7 230(c)   /   Cal. Civ. Code \u00a7 1798.100   /   17 C.F.R. \u00a7 240.10b-5
function parseStatute(text) {
	text = squash(text);
	var m = /^(\d{1,3})\s+([A-Z][A-Za-z.&'\u2019 ]*?[A-Za-z.])\s+(?:\u00a7+|Sec(?:tions?|s?)\.?)\s*([\w.()\-\u2013,]+)/.exec(text);
	var out;
	if (m) out = { kind: 'statute', codeNumber: m[1], code: normCode(m[2]), section: m[3].replace(/[,.]$/, '') };
	else if ((m = /^(\d{1,3})\s+(U\.?S\.?C\.?[AS]?\.?|C\.?F\.?R\.?)\s+(?:\u00a7+\s*)?(\d[\w.()\-\u2013]*)/i.exec(text))) {
		// "37 CFR 42.108", "15 USC 1127"
		out = { kind: 'statute', codeNumber: m[1], code: normCode(m[2]), section: m[3].replace(/[,.]$/, '') };
	}
	else if ((m = /^(\d{1,3})\s+(NYCRR)\s+(?:\u00a7+\s*)?(\d[\w.()\-\u2013]*)/.exec(text))) {
		// "22 NYCRR 100.3" (Westlaw's citation line)
		out = { kind: 'statute', codeNumber: m[1], code: m[2], section: m[3].replace(/[,.]$/, '') };
	}
	else if ((m = /^([A-Z][A-Za-z.&'\u2019 ]*?[A-Za-z.])\s+(?:\u00a7+|Sec(?:tions?|s?)\.?)\s*([\w.()\-\u2013,]+)/.exec(text))) {
		out = { kind: 'statute', codeNumber: '', code: squash(m[1]), section: m[2].replace(/[,.]$/, '') };
	}
	else return null;
	out.rest = squash(text.slice(m[0].length)).replace(/^[\s,:;\u2013\u2014-]+/, '');
	var y = /\((?:[^)]*?)(\d{4})\)/.exec(out.rest);
	if (y) out.year = y[1];
	var pl = /(?:Pub(?:lic|\.)? ?L(?:aw|\.)?(?: ?No\.)?|P\.L\.)\s*(\d+-\d+)/i.exec(text);
	if (pl) out.publicLawNumber = pl[1];
	return out;
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
var STATE_CODES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
	DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
	KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
	MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
	NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
	SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
	WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };
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

var CODE_WORDS = { Civil: 'Civ.', Criminal: 'Crim.', Business: 'Bus.', Commerce: 'Com.', Procedure: 'Proc.', Professions: 'Prof.', Practice: 'Prac.',
	Remedies: 'Rem.', Government: 'Gov\'t', Education: 'Educ.', Insurance: 'Ins.', Labor: 'Lab.', Family: 'Fam.', Public: 'Pub.', Property: 'Prop.',
	Revenue: 'Rev.', Transportation: 'Transp.', Vehicle: 'Veh.', Corporations: 'Corp.', Corporation: 'Corp.', Agriculture: 'Agric.',
	Administrative: 'Admin.', Evidence: 'Evid.', Estates: 'Est.', Utilities: 'Util.', Natural: 'Nat.', Resources: 'Res.', Statutes: 'Stat.',
	Financial: 'Fin.', Human: 'Hum.', Judiciary: 'Jud.', Legislative: 'Legis.', Municipal: 'Mun.', Occupations: 'Occ.', Regulations: 'Regs.',
	Social: 'Soc.', Services: 'Servs.', Service: 'Serv.', Environmental: 'Envtl.', Conservation: 'Conserv.' };

// "New York" + "Civil Rights Law" -> "N.Y. Civ. Rights Law"
function stateCodeName(state, titleDesc) {
	var words = squash(titleDesc).replace(/^Title \d+\.?\s*/i, '')
		.split(' ')
		.map(function (w) {
			return CODE_WORDS[w] || w;
		});
	return squash((STATES[state] || state) + ' ' + words.join(' '));
}

// A citation with no name or parenthetical, as in a Westlaw header line: "168 F.4th 231", "2025 WL 458520"
function parseBareCite(text) {
	text = squash(text);
	var m = /^(\d{4})\s+((?:WL)|(?:[A-Z][A-Za-z.]*(?: [A-Z][A-Za-z.]*)*? LEXIS))\s+(\d+)$/.exec(text);
	if (m) return { volume: m[1], reporter: m[2], page: m[3] };
	m = /^(\d{1,4})\s+([A-Z][A-Za-z0-9.'&\u2019 ]*?)\s+(\d{1,5})$/.exec(text);
	return m && /[.']/.test(m[2]) ? { volume: m[1], reporter: squash(m[2]), page: m[3] } : null;
}

// ---- Jurisdictions ---------------------------------------------------------------------------------------------
// citation-phoenix keeps a case's jurisdiction in its Extra block as a key: "us", "us:c4" (Fourth Circuit), "us:c4:nc.ed" (E.D.N.C.),
// "us:tx" (Texas), "us:dc.d" (D.D.C.). mapJurisdiction follows its court mapper (lib/services/caseCourtMapper.mjs): the rules in
// jurisPhoenixFederal and jurisPhoenixState are its own, in its order, with one repair (longer state names are tried first, so West Virginia is not Virginia).
// Everything after that is added here for what the mapper misses: Lexis's "for the" wording, Bluebook "2d Cir." / "3d Cir.",
// district and state abbreviations ("S.D.N.Y.", "Tex."), and bankruptcy courts.

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

// Restatements of the Law (American Law Institute)
//   Westlaw "Restatement (Second) of Torts § 402A (1965)", Lexis+ "Restat 2d of Torts, § 552A",
//   drafts "Restatement of the Law, Copyright § 1 (Tentative Draft No. 2, 2021)"; and the Model Penal Code ("Model Penal Code § 2.06")
function isRestatement(heading) {
	return /^\s*(?:Restat(?:ement)?s?\b|Model Penal Code\b)/i.test(heading || ''); // the Model Penal Code is cited like a restatement: "(Am. L. Inst. 1985)"
}

var RESTATEMENT_SERIES = { '1st': 'First', '2d': 'Second', '2nd': 'Second', '3d': 'Third', '3rd': 'Third', '4th': 'Fourth',
	first: 'First', second: 'Second', third: 'Third', fourth: 'Fourth' };

// "Restat 2d of Torts", "Restatement of the Law 2d, Torts", "Restatement 2d of Contracts" -> "Restatement (Second) of Torts"
function normalizeRestatementName(name) {
	var n = squash(name);
	var m = /^Restat(?:ement)?(?: of the Law)?,?\s+(1st|2d|2nd|3d|3rd|4th|First|Second|Third|Fourth)\b,?\s+(?:of\s+)?(.+)$/i.exec(n);
	return m ? 'Restatement (' + RESTATEMENT_SERIES[m[1].toLowerCase()] + ') of ' + m[2] : n;
}

// -> { name, section, year, edition }. The item is the work, so the section is returned apart from the name.
function parseRestatement(raw) {
	var t = squash(raw), year = '', edition = '', section = '';
	// a trailing parenthetical with the year and/or the draft: (1965), (Tentative Draft No. 2, 2021)
	var paren = /\s*\(([^()]*)\)\s*$/.exec(t);
	if (paren && /\b(?:1[89]|20)\d\d\b|\bdraft\b/i.test(paren[1])) {
		var y = /\b((?:1[89]|20)\d\d)\b/.exec(paren[1]);
		var d = /((?:Tentative|Council|Discussion|Preliminary|Proposed Final|Final)\s+Draft(?:\s+No\.?\s*\d+)?)/i.exec(paren[1]);
		if (y) year = y[1];
		if (d) edition = squash(d[1]);
		t = t.slice(0, paren.index);
	}
	// the section ("§ 402A", "§§ 1-5"); anything after it, such as Lexis+'s section heading, is dropped
	var sec = /\s*(§§?)\s*(\d[0-9A-Za-z.\-–]*(?:\s*(?:,|and|to|-|–)\s*\d[0-9A-Za-z.\-–]*)*)/.exec(t);
	if (sec) {
		section = sec[1] + ' ' + sec[2].replace(/[.,]+$/, '').trim();
		t = t.slice(0, sec.index);
	}
	return { name: normalizeRestatementName(t.replace(/[,.:;\s]+$/, '')), section: section, year: year, edition: edition };
}

// "Copyright (c) 1977, The American Law Institute" at the end of a Lexis+ document
function findCopyrightYear(text) {
	var m = /(?:©|Copyright)\s*(?:\(c\))?\s*((?:1[89]|20)\d\d)[^.]{0,40}American Law Institute/i.exec(text || '');
	return m ? m[1] : '';
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

// Docket number in a block of text ("No. 89-1909", "Civil Action No. 1:24-cv-01234", "Nos. 21-1, 21-2")
function findDocket(text) {
	var re = /\b((?:Civil Action |Civ\. ?(?:A\. )?|Case |Docket |Cause )?Nos?\.?\s*[A-Za-z0-9][\w:\-\u2013./]*(?:\s*(?:,|and|&)\s*\d[\w:\-\u2013./]*)*)/gi, m;
	text = squash(text);
	while ((m = re.exec(text))) {
		if (/\d/.test(m[1])) return m[1].replace(/[,;.]+$/, '');
	}
	return '';
}
// "March 27, 1991, Decided" -> "March 27, 1991"
function cleanDate(s) {
	return squash(s).replace(/[,;\s]*\b(?:Decided|Filed|Argued|Submitted|Entered|Amended)\b.*$/i, '');
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
// A code that is a regulatory compilation (not the NYC Administrative Code, which is legislation)
var REGULATORY_CODE = /^C\.?F\.?R\.?$|^NYCRR$|\bAdmin(?:istrative|\.)|\bComp\.? Codes? R\.|\bRegs?\.|\bRegulations\b/i;
function isRegulationCode(code) {
	return REGULATORY_CODE.test(code || '') && !/^N\.?Y\.?C\.?\s+Admin/i.test(code);
}
// The latest "effective 06/01/26" (a state regulation's History line), as "June 1, 2026"
function latestNumericEffective(text) {
	var re = /effective\s+(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/gi, m, best = '', bestT = -Infinity;
	while ((m = re.exec(text || ''))) {
		var y = +m[3] < 100 ? (+m[3] < 70 ? 2000 : 1900) + +m[3] : +m[3], t = Date.UTC(y, +m[1] - 1, +m[2]);
		if (+m[1] >= 1 && +m[1] <= 12 && t > bestT) {
			bestT = t;
			best = MONTH_NAMES[+m[1] - 1] + ' ' + m[2].replace(/^0/, '') + ', ' + y;
		}
	}
	return best;
}
// The latest of several "Month d, yyyy" dates ('' entries are ignored)
function laterDate(dates) {
	var best = '', bestT = -Infinity;
	for (var i = 0; i < dates.length; i++) {
		var m = dates[i] && DATE_RE.exec(dates[i]), t = m ? Date.UTC(+m[3], MONTH_NAMES.indexOf(fullMonth(m[1])), +m[2]) : -Infinity;
		if (t > bestT) {
			bestT = t;
			best = dates[i];
		}
	}
	return best;
}
// The dates the text calls effective ("effective December 11, 2025", "eff Sept. 1, 2020"), joined for latestDate
function effectiveDates(text) {
	var re = new RegExp('\\beff(?:ective|\\.)?\\s+((?:' + MONTHS + ')\\.?\\s+\\d{1,2},?\\s+\\d{4})', 'gi'), m, out = [];
	while ((m = re.exec(text || ''))) out.push(m[1]);
	return out.join('; ');
}
// The latest of the dates in the text ("effective Sept. 16, 2012; ... effective Jan. 8, 2021"), as "January 8, 2021"
function latestDate(text) {
	var re = new RegExp(DATE_RE.source, 'gi'), m, best = '', bestT = -Infinity;
	while ((m = re.exec(text || ''))) {
		var t = Date.UTC(+m[3], MONTH_NAMES.indexOf(fullMonth(m[1])), +m[2]);
		if (t > bestT) {
			bestT = t;
			best = fullMonth(m[1]) + ' ' + m[2] + ', ' + m[3];
		}
	}
	return best;
}
// ---- end shared ----

// Text of an element with a space between text nodes (textContent glues neighbouring blocks together)
function spacedText(el) {
	if (!el) return '';
	var w = el.ownerDocument.createTreeWalker(el, 4), parts = [], n;
	while ((n = w.nextNode())) parts.push(n.nodeValue);
	return squash(parts.join(' '));
}

// First non-empty text among CSS selectors
function firstText(doc, selectors) {
	for (var i = 0; i < selectors.length; i++) {
		var el = doc.querySelector(selectors[i]);
		var t = spacedText(el);
		if (t) return t;
	}
	return '';
}

// Work out what a document page is. `page` = { pageTitle, title, cite, court, date, body }
function classify(page) {
	page.date = cleanDate(page.date);
	var paren = squash([page.court, page.date].filter(Boolean).join(' '));
	var tries = [page.pageTitle, page.title];
	if (page.title && page.cite) tries.push(page.title + ', ' + page.cite + (paren ? ' (' + paren + ')' : ''));
	var parsed = null;
	// a code section (title "37 CFR 42.108", "15 USCS \u00a7 1127") is never a case, whatever else the page says
	var early = page.title && !/ v\.? /.test(page.title) && parseStatute(page.title);
	if (early) return statuteResult(early, page, findDate(page.date) || findDate(page.body) || '');
	var bare = page.cite && parseBareCite(page.cite);
	if (bare && page.title && (page.court || / v\.? /.test(page.title))) {
		var pp = parseParen(paren);
		parsed = { kind: 'case', name: page.title, volume: bare.volume, reporter: bare.reporter, page: bare.page, court: pp.court || page.court, date: pp.date, year: pp.year };
	}
	else if (bare && page.title && NOT_A_CASE_RE.test(bare.reporter)) {
		var my = new RegExp('(' + MONTHS + ')\\.?,?\\s+(?:\\d{1,2},?\\s+)?(\\d{4})', 'i').exec(page.date || '');
		parsed = { kind: 'article', author: page.author || '', title: page.title, volume: bare.volume, reporter: bare.reporter, page: bare.page, year: my ? my[2] : (/\b(\d{4})\b/.exec(page.date || '') || [])[1] || '', date: my ? my[1].replace(/\.$/, '') + ' ' + my[2] : '' };
	}
	for (var i = 0; !parsed && i < tries.length; i++) parsed = tries[i] && parseCitation(tries[i]);

	var extra = { court: page.court, date: findDate(page.date) || findDate(page.body) || '', docket: findDocket((page.info || '') + '\n' + (page.body || '').slice(0, 1200)) };
	if (parsed) {
		if (parsed.kind === 'case' && parsed.date && /^\d{4}$/.test(parsed.date) && extra.date && extra.date.slice(-4) === parsed.date) parsed.date = extra.date;
		return { parsed: parsed, extra: extra };
	}
	var st = [page.title, page.pageTitle, page.title + ' ' + page.cite].reduce(function (r, t) {
		return r || (t && parseStatute(t));
	}, null);
	return st ? statuteResult(st, page, extra.date) : null;
}

function statuteResult(st, page, date) {
	if (!st.rest && page.banner) {
		// Lexis prints the section heading in the banner: "\u00a7 42.108 Institution of inter partes review."
		var bm = /^\u00a7+\s*(\S+?)\.?\s+(.+?)\.?$/.exec(squash(page.banner));
		if (bm && bm[1].replace(/\.$/, '') === st.section.replace(/\.$/, '')) st.rest = bm[2];
	}
	if (!st.rest && page.body) {
		// the section heading in the text: "47-25-1102. Part definitions."
		var sec = st.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// "47-25-1102. Part definitions." or "\u00a7 42.108 Institution of inter partes review. (a)"
		var nm = new RegExp('(?:\\u00a7+\\s*' + sec + '\\.?|' + sec + '\\.)\\s+([A-Z][^.]{2,120}?)\\.\\s').exec(page.body);
		if (nm) st.rest = nm[1];
	}
	return { parsed: st, extra: { date: date, title: st.rest } };
}

var TYPE_OF = { case: 'case', statute: 'statute', article: 'journalArticle', treatise: 'bookSection', restatement: 'book' };

// "Author: Jeremy N. Sheff * * Associate Professor..." (Lexis) -> "Jeremy N. Sheff"
// "Author: JEANNE C. FROMER + & MARK P. MCKENNA ++ + Professor of Law..." -> "JEANNE C. FROMER; MARK P. MCKENNA"
// Names are read one at a time; after the footnote marks another name only follows if there is a "&", "and" or ";".
function findAuthor(text) {
	var m = /\bAuthors?:\s*(.*)$/.exec(squash(text));
	if (!m) return '';
	var rest = m[1].replace(/\s+(?:Text|Length:|Source:)\b.*$/, ''), names = [];
	// a name ends at a footnote mark (also after a comma: "Buccafusco,* Lemley,** & Masur***"), "&", "and", ";" or the end
	var nameRE = /^\s*([A-Za-z][A-Za-z.'\u2019-]*(?:\s+[A-Za-z][A-Za-z.'\u2019-]*){1,4}?)\s*(?=,?\s*[*+\u2020\u2021]|,\s*(?:&|and\b)|&|\band\b|;|$)/;
	for (;;) {
		var n = nameRE.exec(rest);
		if (!n) break;
		names.push(n[1]);
		var marks = /^,?[\s*+\u2020\u2021\d]*/.exec(rest.slice(n[0].length))[0];
		rest = rest.slice(n[0].length + marks.length).replace(/^,\s*/, '');
		var sep = /^(?:&|and\b|;)\s*/.exec(rest);
		if (sep) rest = rest.slice(sep[0].length);
		else if (!(/^,/.test(marks) && /[*+\u2020\u2021]/.test(marks))) break; // a comma after the footnote mark's name also separates: "A,* B,** & C"
	}
	return names.join('; ');
}

// Book-section treatises: parsed = { kind: 'treatise', title, bookTitle, volume, section, edition, date, author }

// Save the page itself with the item
function addSnapshot(item, doc) {
	item.attachments.push({ title: 'Snapshot', document: doc });
}


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

// The History section of a state regulation: the text after the "History" banner (#JUMPTO_History), up to the next banner
function historyText(doc) {
	var h = doc.getElementById('JUMPTO_History'), out = [], n = h && h.nextSibling;
	while (n && !(n.nodeType === 1 && /^H[1-6]$/.test(n.nodeName))) {
		out.push(n.textContent);
		n = n.nextSibling;
	}
	return squash(out.join(' ')).replace(/\s*Annotations.*$/, '').slice(0, 3000); // the notes that follow cite other laws and other dates
}

function readPage(doc) {
	var infos = doc.querySelectorAll(INFO_SEL), info = [];
	for (var i = 0; i < infos.length; i++) info.push(spacedText(infos[i]));
	var court = info[0] || '', title = cleanTitle(firstText(doc, TITLE_SEL)).replace(/,\s*Part \d+ of \d+$/i, ''); // a long section is split: "35 USCS \u00a7 101, Part 1 of 2"
	var rptrs = [], rn = doc.querySelectorAll('a.SS_ActiveRptr, span.SS_NonPaginatedRptr');
	for (var r = 0; r < rn.length; r++) rptrs.push(squash(rn[r].textContent));
	var date = cleanDate(firstText(doc, DATE_SEL)) || findDate(info.join(' ')) || (info.filter(function (i) {
		return /^(?:\w+\.?,? )?\d{4}$|^[A-Z][a-z]+\.?,? \d{4}$/.test(i);
	})[0] || ''); // articles: "October, 2012"
	return {
		pageTitle: cleanTitle(doc.title),
		title: title,
		cite: firstText(doc, CITE_SEL),
		court: /\b(?:Court|Circuit|Tribunal|Judicial|Bankruptcy|Board|Commission)\b/i.test(court) && court.length < 120 ? court : '', // not "Current through ..." (codes, regulations)
		date: date,
		info: info.join('\n'),
		body: bodyAfter(doc, title),
		banner: firstText(doc, ['h2.SS_Banner']),
		copyright: isRestatement(title) && !/^Model Penal Code/i.test(title) ? findCopyrightYear(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body)) : '', // the year is on the last line of the document
		effectiveNote: (/EFFECTIVE DATE NOTE:(.*?)(?:\]|$)/.exec(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body)) || [])[1] || '', // C.F.R.: "... effective Jan. 8, 2021."
		history: historyText(doc),
		refersTo: (/Find references to this ([a-z]+)/.exec(doc.body ? doc.body.textContent : '') || [])[1] || '', // the Info pane: "Find references to this treatise"
		reporters: rptrs, // "140 Stat. 1026", "119 P.L. 111": the session law's citations
		heading: /\bCLS\b/.test(title) ? (/Heading\s+.*?Consolidated Laws Service\s+(.+?)\s+\((?:Arts?|Chs?|Titles?|Parts?|\u00a7)/.exec(spacedText(doc.querySelector('.document-wrapper, #document-content, main') || doc.body)) || [])[1] || '' : '', // New York: "Civil Rights Law (Arts. 1 \u2014 15)"
		crumb: firstText(doc, ['.SS_TOCTrail li a']),
		author: findAuthor(bodyAfter(doc, title)),
	};
}

function detectWeb(doc, url) {
	watchForChanges(doc);
	try {
		var type = detect(doc);
		Zotero.debug('Lexis (legal): detectWeb -> ' + type + ' for ' + url.replace(/[?#].*$/, ''));
		if (!type) Zotero.debug('Lexis (legal): page read as ' + JSON.stringify(readPage(doc), function (k, v) {
			return k === 'body' ? undefined : v;
		}));
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

// Restatement section: h1 and <title> "Restat 2d of Torts, \u00a7 552A", banner (h2.SS_Banner) "\u00a7 552A Contributory Negligence";
// the last line of the document says "Copyright (c) 1977, The American Law Institute" (the Model Penal Code's says "Copyright2026, American Law Institute": the year of the page, not of the text)
function restatementFromPage(page) {
	if (!isRestatement(page.title)) return null;
	var p = parseRestatement(page.title);
	return { kind: 'restatement', title: p.name, year: p.year || page.copyright, edition: p.edition,
		section: p.section && (page.banner || '').indexOf(p.section) === 0 ? page.banner : p.section };
}

// Treatise section: h1 "8 Gilson on Trademarks 1207", breadcrumb trail starting with the book title,
// banner (h2.SS_Banner) "1207 Refusal on Basis of ..."
function treatiseFromPage(page) {
	// "8 Gilson on Trademarks 1207" (banner "1207 Refusal ...") or "2 Nimmer on Copyright \u00a7 8.02" (banner "\u00a7 8.02 The Reproduction Right")
	var m = /^(\d{1,3})\s+(.+?)\s+(?:\u00a7+\s*)?(\d[\w.:-]*)$/.exec(page.title), b = /^(?:\u00a7+\s*)?(\S+)\s+(.+)$/.exec(page.banner || '');
	if (!m || !b || b[1] !== m[3]) return null;
	if ((/\u00a7/.test(page.title) || /^\u00a7/.test(page.banner)) && page.refersTo !== 'treatise') return null; // a section sign could be a code ("35 USCS \u00a7 101", "37 CFR 42.108"); the page says "Find references to this treatise"
	return { kind: 'treatise', title: b[2], bookTitle: page.crumb || m[2], volume: m[1], section: m[3], edition: '', date: '', author: '' };
}

// Session law (an act): h1 "Lindsey O. Graham Sanctioning Russia and Iran Act of 2026, 2026 Enacted H.R. 5334, 119 Enacted H.R. 5334",
// reporters "119 P.L. 111" and "140 Stat. 1026", info "Enacted, September 18, 2026"
function sessionLawFromPage(page) {
	if (/\u00a7/.test(page.title)) return null;
	var stat = null, pl = null;
	page.reporters.forEach(function (r) {
		stat = stat || /^(\d+)\s+Stat\.\s+(\d+)/.exec(r);
		pl = pl || /^(\d+)\s+P\.L\.\s+(\d+)/.exec(r);
	});
	if (!stat && !pl) return null;
	var name = squash(page.title.replace(/,\s*\d{4}\s+Enacted\b.*$/i, '').replace(/,\s*\d+\s+Enacted\b.*$/i, ''));
	return { kind: 'statute', codeNumber: stat ? stat[1] : '', code: stat ? 'Stat.' : '', section: stat ? stat[2] : '', publicLawNumber: pl ? pl[1] + '-' + pl[2] : '', session: pl ? pl[1] : '',
		rest: name, date: findDate(page.info) };
}

function classifyLexis(page) {
	var sl = sessionLawFromPage(page);
	if (sl) return { parsed: sl, extra: { title: sl.rest, date: sl.date } };
	var rs = restatementFromPage(page);
	if (rs) return { parsed: rs, extra: {} };
	var tr = treatiseFromPage(page);
	if (tr) return { parsed: tr, extra: {} };
	var c = classify(page), cls = c && c.parsed.kind === 'statute' && /^([A-Z]{2}) CLS\b/.exec(c.parsed.code);
	if (cls && STATE_CODES[cls[1]] && page.heading) c.parsed.code = stateCodeName(STATE_CODES[cls[1]], page.heading); // "NY CLS Civ R" -> "N.Y. Civil Rights Law"
	if (c && c.parsed.kind === 'statute' && isRegulationCode(c.parsed.code)) {
		// a regulation is dated by the latest of: the Federal Register notices listed in its History ("85 FR 79120, 79129, Dec. 9, 2020"),
		// the dates in an Effective Date Note, and a state History line's "effective 06/01/26"; never by "current through"
		c.extra.date = laterDate([latestDate(page.history), latestDate(page.effectiveNote), latestNumericEffective(page.history)]);
	}
	else if (c && c.parsed.kind === 'statute') {
		// a codified statute: the latest effective date in its History ("L 2025, ch 616, \u00a7 1, effective December 11, 2025"), else the latest
		// date there (the act's, "July 19, 1952, ch 950"); never "current through"
		c.extra.date = latestDate(effectiveDates(page.history)) || latestDate(page.history) || '';
	}
	return c;
}

function detect(doc) {
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
				await scrape(await requestDocument(u));
			}
			catch (e) {
				Zotero.debug('Lexis: skipped ' + u + ': ' + e.message); // news, agency decisions, etc.
			}
		}
	}
	else {
		await scrape(doc);
	}
}

// A treatise's authors, publisher and currency are in the Info pane's "Source Information" dialog (#sourceInfoContent), which the page
// draws when the link under "Source Information" is clicked: "Publisher: Matthew Bender & Company, Inc.", "Coverage: Through August 2026;
// Release No. 126", "Description: AUTHORS: Melville B. Nimmer, author 1963-85; David Nimmer, revision author 1986 to present. ..."
// Coverage reads "Through August 2026; Release No. 126" or "Current through the 2007 Edition."
function parseSourceInfo(el) {
	var t = el ? spacedText(el) : '', pub = /Publisher:\s*(.+?)\s+(?:Coverage|Frequency|Update Schedule|Description):/.exec(t),
		cov = new RegExp('Coverage:\\s*(?:Current\\s+)?through\\s+(?:the\\s+)?((?:(?:' + MONTHS + ')\\.?\\s+)?\\d{4})', 'i').exec(t),
		au = /AUTHORS?:\s*(.{0,400})/.exec(t), names = [], m, nameRE = /([A-Z][\w.'\u2019-]*(?:\s+[A-Z][\w.'\u2019-]*)+),\s+(?:[a-z]+\s+)*(?:author|editor)\b/g;
	while (au && (m = nameRE.exec(au[1]))) names.push(m[1]); // "Melville B. Nimmer, author 1963-85; David Nimmer, revision author 1986 to present."
	return { publisher: pub ? pub[1] : '', date: cov ? cov[1] : '', author: names.join('; ') };
}

function pause(ms) {
	return Zotero.Promise && Zotero.Promise.delay ? Zotero.Promise.delay(ms) : new Promise(function (r) {
		setTimeout(r, ms);
	});
}

// The dialog is not in the saved page until the link is clicked, so click it (and close the dialog afterwards)
async function readSourceInfo(doc) {
	var content = doc.getElementById('sourceInfoContent'), opened = false;
	if (!content) {
		var links = doc.querySelectorAll('.docinfolink'), link = null;
		for (var i = 0; i < links.length && !link; i++) {
			if (/Source Information/.test(links[i].textContent)) link = links[i].querySelector('a');
		}
		if (!link) return {};
		try {
			link.click();
			opened = true;
			for (var tries = 0; tries < 20 && !(content = doc.getElementById('sourceInfoContent')); tries++) await pause(150);
		}
		catch (e) {
			Zotero.debug('Lexis (legal): source information: ' + e);
		}
	}
	var info = parseSourceInfo(content);
	if (opened) {
		try {
			var close = doc.querySelector('#sourceinfo-dialog [data-action="cancel"]');
			if (close) close.click();
		}
		catch (e) {
			Zotero.debug('Lexis (legal): closing source information: ' + e);
		}
	}
	return info;
}

async function scrape(doc) {
	var c = classifyLexis(readPage(doc));
	if (!c) throw new Error('Lexis: could not read a citation from this page');
	if (c.parsed.kind === 'treatise') {
		var si = await readSourceInfo(doc), cp = /Copyright (\d{4}), ([^,]+?(?:, Inc\.)?), a member of/.exec(spacedText(doc.querySelector('#document-content, .document-wrapper, main') || doc.body));
		c.parsed.author = c.parsed.author || si.author;
		c.parsed.publisher = si.publisher || (cp ? cp[2] : '');
		c.parsed.date = c.parsed.date || si.date || (cp ? cp[1] : '');
	}
	var item = buildItem(c.parsed, c.extra);
	// Lexis URLs are long session links that do not work for anyone else, so none is saved
	item.libraryCatalog = 'Lexis+';
	addSnapshot(item, doc);
	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
