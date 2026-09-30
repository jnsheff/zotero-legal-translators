"""Assemble translators/*.js from src/: header + src/<site>.js with src/shared.js spliced in.
Usage: python3 build.py [--check]   (--check fails if translators/ is out of date)"""
import json, sys, os, datetime
root = os.path.dirname(os.path.abspath(__file__))
shared = open(f'{root}/src/shared.js').read()
LICENSE = "\n/*\n\tMIT License. Copyright (c) 2026 jnsheff. See LICENSE in the repository.\n*/\n\n"
T = {
  'Westlaw': dict(translatorID='8c959974-3afc-4f7e-afd0-20e7bc3c19c1', label='Westlaw (legal)', target=r'^https?://(?:[a-z0-9-]+\.)*westlaw\.com/', src='westlaw.js'),
  'LII': dict(translatorID='2b8c3a5e-7d41-4c8e-9a53-6e0f1d2c9b74', label='Cornell LII (legal)', target=r'^https?://(?:www\.)?law\.cornell\.edu/', src='lii.js'),
  'Lexis': dict(translatorID='4a07416a-1dde-4a8e-b9a1-7aa69007af19', label='Lexis+ (legal)', target=r'^https?://(?:plus|advance)\.lexis\.com/', src='lexis.js'),
}
bad = 0
for name, t in T.items():
    path = f'{root}/translators/{t["label"]}.js'
    body = open(f'{root}/src/{t["src"]}').read().replace('/*SHARED*/', shared)
    old = open(path).read() if os.path.exists(path) else ''
    def render(stamp):
        h = dict(translatorID=t['translatorID'], label=t['label'], creator='jnsheff', target=t['target'], minVersion='5.0',
                 maxVersion='', priority=90, inRepository=False, translatorType=4, browserSupport='gcsibv', lastUpdated=stamp)
        return json.dumps(h, indent='\t') + '\n' + LICENSE + body
    import re
    m = re.search(r'"lastUpdated": "([^"]*)"', old)
    if m and render(m.group(1)) == old: continue          # unchanged
    if '--check' in sys.argv: print('out of date:', path); bad = 1; continue
    open(path, 'w').write(render(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')))
    print('wrote', path)
sys.exit(bad)
