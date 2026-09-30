"""Zotero requires applications.zotero.{id,update_url,strict_max_version}."""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
m = json.load(open(os.path.join(here, '..', 'addon', 'manifest.json')))
z = m.get('applications', {}).get('zotero', {})
errors = [f'applications.zotero.{k} not provided' for k in ('id', 'update_url', 'strict_max_version') if not z.get(k)]
if z.get('update_url') and not re.match(r'^https?://[^/\s]+', z['update_url']): errors.append('update_url is not a URL')
for k in ('name', 'version', 'manifest_version'):
    if not m.get(k): errors.append(f'{k} missing')
upath = os.path.join(here, '..', 'updates.json')
if os.path.exists(upath):
    ups = json.load(open(upath)).get('addons', {}).get(z.get('id'), {}).get('updates', [])
    if not [u for u in ups if u.get('version') == m.get('version')]:
        errors.append('updates.json has no entry for version ' + str(m.get('version')))
print('\n'.join(errors) if errors else 'manifest OK')
