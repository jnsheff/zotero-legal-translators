{
	"translatorID": "9d1e6b34-5c72-4a0f-8e3b-2f6a7c40d195",
	"label": "Federal Register (legal)",
	"creator": "jnsheff",
	"target": "^https?://(?:www\\.)?federalregister\\.gov/documents/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 90,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-10-11 16:19:11"
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

var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Save the page itself with the item
function addSnapshot(item, doc) {
	item.attachments.push({ title: 'Snapshot', document: doc });
}


// Federal Register (www.federalregister.gov): a document page (Rule, Proposed Rule, Notice, Presidential Document) is saved as a
// Statute marked as citation-phoenix's "regulation" type and filed under "Fed. Reg." (volume in Code Number, first page in Section), as the Westlaw
// translator saves a Federal Register document;
// hicite exports it as a government document ("90 Fed. Reg. 40975 (Aug. 22, 2025)"). The page's "Document Details" and "Document
// Dates" boxes give the rest, kept in Extra; the PDF of the printed version is the snapshot.
//
//   h1 in #metadata_content_area           the title
//   #utility-nav-document-details dl       Agencies, CFR, Document Citation ("90 FR 40975"), Document Number, Document Type, Pages, Publication Date, RIN
//   #utility-nav-document-dates dl         Effective Date, Comments Close ... (ISO dates), Dates Text
//   #utility-nav-regs-dot-gov dl           Docket ID
//   a[href$=".pdf"] "View printed version"  the printed page images (govinfo)

// citation-phoenix's "regulation" type is a Statute with this marker in Extra (the Statute fields all stay valid, so a document saved
// without the add-on is still an ordinary Statute); the document details follow it, one per line
var REGULATION_EXTRA = 'mlzsync1:{"xtype":"regulation"}';

var DOC_URL = /^https?:\/\/(?:www\.)?federalregister\.gov\/documents\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\/[\w-]+/;

// "08/22/2025" or "2025-08-22" -> "August 22, 2025"
function frDate(s) {
	var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(s || '') || /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s || '');
	if (!m) return '';
	var iso = m[1].length === 4, mon = +(iso ? m[2] : m[1]), day = +(iso ? m[3] : m[2]), year = iso ? m[1] : m[3];
	return mon >= 1 && mon <= 12 ? MONTH_NAMES[mon - 1] + ' ' + day + ', ' + year : '';
}

// The rows of the page's definition lists: { "Document Citation": "90 FR 40975", ... }
function readRows(doc) {
	var rows = {}, dts = doc.querySelectorAll('#utility-nav-document-details dt, #utility-nav-document-dates dt, #utility-nav-regs-dot-gov dt, dl.metadata_list dt');
	for (var i = 0; i < dts.length; i++) {
		var label = squash(dts[i].textContent), vals = [], dd = dts[i].nextElementSibling;
		while (dd && dd.nodeName === 'DD') {
			vals.push(squash(dd.textContent.replace(/Copy to Clipboard/g, '')));
			dd = dd.nextElementSibling;
		}
		if (label && !(label in rows)) rows[label] = vals;
	}
	return rows;
}

function readDocument(doc, url) {
	var rows = readRows(doc), one = function (k) {
		return rows[k] ? rows[k][0] : '';
	};
	var cite = /^(\d{1,3})\s+FR\s+(\d+)/.exec(one('Document Citation'));
	if (!cite) return null;
	var h1 = doc.querySelector('#metadata_content_area h1'), title = squash(h1 ? h1.textContent : '') ||
		squash((doc.querySelector('meta[property="og:title"]') || {}).content || '');
	var pages = /^(\d+)(?:\s*-\s*(\d+))?/.exec(one('Pages')), pdf = null, links = doc.querySelectorAll('a[href]');
	for (var i = 0; i < links.length && !pdf; i++) {
		if (/govinfo\.gov\/content\/pkg\/.*\.pdf/i.test(links[i].href) || /View printed version/i.test(links[i].textContent)) pdf = links[i].href;
	}
	var summary = doc.querySelector('#summary p');
	var canonical = doc.querySelector('link[rel="canonical"]');
	return { title: title, volume: cite[1], page: cite[2], pages: pages ? pages[1] + (pages[2] ? '-' + pages[2] : '') : '', date: frDate(one('Publication Date')),
		rows: rows, pdf: pdf, summary: squash(summary ? summary.textContent : '') || squash((doc.querySelector('meta[name="description"]') || {}).content || ''),
		url: (canonical && canonical.href) || url.replace(/[?#].*$/, '') };
}

function detectWeb(doc, url) {
	return DOC_URL.test(url) && readDocument(doc, url) ? 'statute' : false;
}

async function doWeb(doc, url) {
	await scrape(doc, url);
}

async function scrape(doc, url) {
	var d = readDocument(doc, url);
	if (!d) throw new Error('Federal Register: not a document page');
	var item = new Zotero.Item('statute'), extra = [REGULATION_EXTRA], one = function (k) {
		return d.rows[k] ? d.rows[k][0] : '';
	};
	item.nameOfAct = fixCase(d.title);
	item.code = 'Fed. Reg.';
	item.codeNumber = d.volume;
	item.section = d.page;
	if (d.pages) item.pages = d.pages;
	item.dateEnacted = d.date; // the publication date, which a Bluebook citation gives
	if (d.summary) item.abstractNote = d.summary;
	item.url = d.url;
	item.libraryCatalog = 'Federal Register';
	// the rest of the document details, in Extra
	if (one('Document Type')) extra.push('Document Type: ' + one('Document Type'));
	if (d.rows.Agencies) extra.push('Agency: ' + d.rows.Agencies.join('; '));
	if (one('CFR')) extra.push('CFR: ' + one('CFR'));
	['Effective Date', 'Comments Close', 'Comments Open', 'Comment Date'].forEach(function (k) {
		if (one(k)) extra.push(k + ': ' + (frDate(one(k)) || one(k)));
	});
	if (one('Document Number')) extra.push('Document Number: ' + one('Document Number'));
	if (one('RIN')) extra.push('RIN: ' + one('RIN'));
	if (one('Docket ID')) extra.push('Docket ID: ' + one('Docket ID'));
	if (extra.length) item.extra = extra.join('\n');
	if (d.pdf) item.attachments.push({ title: 'Snapshot', mimeType: 'application/pdf', url: d.pdf });
	else addSnapshot(item, doc);
	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
