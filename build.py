"""Assemble translators/*.js from src/: header + src/<site>.js with src/shared.js spliced in (unused shared
functions removed, as Zotero's linter requires) + the test cases in tests/<label>.json, if any.
Usage: python3 build.py [--check]   (--check fails if translators/ is out of date)"""
import json, sys, os, re, datetime
root = os.path.dirname(os.path.abspath(__file__))
shared = open(f'{root}/src/shared.js').read()
LICENSE = """
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

"""
T = {
  'Westlaw': dict(translatorID='8c959974-3afc-4f7e-afd0-20e7bc3c19c1', label='Westlaw (legal)', target=r'^https?://(?:[a-z0-9-]+\.)*westlaw\.com/', src='westlaw.js'),
  'LII': dict(translatorID='2b8c3a5e-7d41-4c8e-9a53-6e0f1d2c9b74', label='Cornell LII (legal)', target=r'^https?://(?:www\.)?law\.cornell\.edu/', src='lii.js'),
  'Lexis': dict(translatorID='4a07416a-1dde-4a8e-b9a1-7aa69007af19', label='Lexis+ (legal)', target=r'^https?://(?:plus|advance)\.lexis\.com/', src='lexis.js'),
}

def units(text):
    """Split code into top-level units: a column-0 'function'/'var' declaration with its leading // comments,
    running to the next declaration. Returns a list of (name or None, text)."""
    lines = text.split('\n')
    out, cur, name = [], [], None
    def flush():
        nonlocal cur, name
        if cur: out.append((name, '\n'.join(cur)))
        cur, name = [], None
    pending = []          # comment lines waiting for their declaration
    for ln in lines:
        m = re.match(r'(?:async\s+)?function\s+(\w+)|var\s+(\w+)\b', ln)
        if m:
            flush(); cur = pending + [ln]; pending = []; name = m.group(1) or m.group(2)
        elif ln.startswith('//'):
            if cur and cur[-1].strip() == '' or not cur: pending.append(ln)
            else: pending.append(ln)
        else:
            if pending: cur.extend(pending); pending = []
            cur.append(ln)
    cur.extend(pending); flush()
    return out

def shake(shared_text, site_text):
    """Drop shared units that neither the site code nor another kept unit refers to."""
    us = units(shared_text)
    kept = list(us)
    while True:
        code = site_text + '\n' + '\n'.join(t for _, t in kept)
        drop = []
        for i, (name, t) in enumerate(kept):
            if not name: continue
            others = site_text + '\n' + '\n'.join(u for j, (_, u) in enumerate(kept) if j != i)
            if not re.search(r'\b%s\b' % re.escape(name), others): drop.append(i)
        if not drop: break
        kept = [u for i, u in enumerate(kept) if i not in drop]
    return '\n'.join(t for _, t in kept)

bad = 0
for name, t in T.items():
    path = f'{root}/translators/{t["label"]}.js'
    site = open(f'{root}/src/{t["src"]}').read()
    site_only = site.replace('/*SHARED*/', '')
    body = site.replace('/*SHARED*/', shake(shared, site_only))
    tests = f'{root}/tests/{t["label"]}.json'
    if os.path.exists(tests):
        cases = json.dumps(json.load(open(tests)), indent='\t', ensure_ascii=False)
        body = body.rstrip('\n') + '\n\n\n/** BEGIN TEST CASES **/\nvar testCases = ' + cases + '\n/** END TEST CASES **/\n'
    else:
        body = body.rstrip('\n') + '\n\n\n/** BEGIN TEST CASES **/\nvar testCases = [\n]\n/** END TEST CASES **/\n'
    old = open(path).read() if os.path.exists(path) else ''
    def render(stamp):
        h = dict(translatorID=t['translatorID'], label=t['label'], creator='jnsheff', target=t['target'], minVersion='5.0',
                 maxVersion='', priority=90, inRepository=True, translatorType=4, browserSupport='gcsibv', lastUpdated=stamp)
        return json.dumps(h, indent='\t') + '\n' + LICENSE + body
    m = re.search(r'"lastUpdated": "([^"]*)"', old)
    if m and render(m.group(1)) == old: continue          # unchanged
    if '--check' in sys.argv: print('out of date:', path); bad = 1; continue
    open(path, 'w').write(render(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')))
    print('wrote', path)
sys.exit(bad)
