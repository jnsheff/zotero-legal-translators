// The installer plugin: writes the three translators (only when they differ), reloads translators only when
// something changed, removes them only on a real uninstall (reason 6), and lists exactly the built translators.
var errors = [], files = {}, reinits = 0, logged = [];
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(m + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
var Zotero = { initializationPromise: Promise.resolve(), logError: function (e) { logged.push(e.message); },
	getTranslatorsDirectory: function () { return { path: '/tz' }; },
	Translators: { reinit: function () { reinits++; return Promise.resolve(); } },
	File: {
		getResourceAsync: function (url) {
			var m = /translators\/(.+)$/.exec(url); var name = decodeURIComponent(m[1]);
			return Promise.resolve(read('translators/' + name));
		},
		getContentsAsync: function (p) { return p in files ? Promise.resolve(files[p]) : Promise.reject(new Error('missing')); },
		putContentsAsync: function (p, s) { files[p] = s; return Promise.resolve(); },
	} };
var IOUtils = { remove: function (p) { delete files[p]; return Promise.resolve(); } };
var PathUtils = { join: function () { return Array.prototype.join.call(arguments, '/'); } };
var src = read('addon/bootstrap.js');
var B = new Function('Zotero', 'IOUtils', 'PathUtils', 'fetch', src + '; return { startup: startup, uninstall: uninstall, list: TRANSLATORS };')(Zotero, IOUtils, PathUtils, null);

// the list is exactly the translators build.py produces
var built = ['Westlaw (legal).js', 'Lexis+ (legal).js', 'Cornell LII (legal).js'];
eq(B.list, built, 'installer lists the built translators');
var manifest = JSON.parse(read('addon/manifest.json'));
eq(manifest.applications.zotero.id, 'zotero-legal-translators@zotero.local', 'plugin id');

B.startup({ rootURI: 'jar:file:///x.xpi!/' }).then(function () {
	eq(Object.keys(files).sort(), built.map(function (n) { return '/tz/' + n; }).sort(), 'three files installed');
	built.forEach(function (n) { eq(files['/tz/' + n] === read('translators/' + n), true, n + ' installed unchanged'); });
	eq(reinits, 1, 'translators reloaded once after installing');
	return B.startup({ rootURI: 'jar:file:///x.xpi!/' });
}).then(function () {
	eq(reinits, 1, 'second start: nothing changed, no reload');
	files['/tz/Westlaw (legal).js'] = 'old version';
	return B.startup({ rootURI: 'jar:file:///x.xpi!/' });
}).then(function () {
	eq(reinits, 2, 'an outdated file is replaced and translators reloaded');
	eq(files['/tz/Westlaw (legal).js'] === read('translators/Westlaw (legal).js'), true, 'outdated file replaced');
	return Promise.all([B.uninstall({}, 7), B.uninstall({}, 8)]);
}).then(function () {
	eq(Object.keys(files).length, 3, 'upgrade / downgrade keep the translators');
	return B.uninstall({}, 6);
}).then(function () {
	eq(Object.keys(files).length, 0, 'real uninstall removes them');
	eq(logged, [], 'no errors logged');
	print(errors.length ? 'PACKAGE FAILED\n' + errors.join('\n') : 'package OK (install, no-op restart, update, upgrade-safe uninstall)');
}).catch(function (e) { print('PACKAGE FAILED\nexception: ' + e.message + '\n' + e.stack); });
