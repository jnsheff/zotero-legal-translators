/* Installs the translators in translators/ into Zotero's translators directory (and keeps them current),
 * removing them again when the plugin is uninstalled. */

const TRANSLATORS = ['Westlaw (legal).js', 'Lexis+ (legal).js', 'Cornell LII (legal).js'];

async function readPackaged(url) {
	// getContentsFromURLAsync cannot fetch jar: URLs; getResourceAsync opens a channel
	try {
		return await Zotero.File.getResourceAsync(url);
	}
	catch (e) {
		let response = await fetch(url);
		if (!response.ok) throw new Error(`Could not read ${url}: ${response.status}`);
		return await response.text();
	}
}

async function startup({ rootURI }) {
	await Zotero.initializationPromise;
	let dir = Zotero.getTranslatorsDirectory().path, changed = false;
	for (let name of TRANSLATORS) {
		try {
			let source = await readPackaged(rootURI + 'translators/' + encodeURI(name));
			let path = PathUtils.join(dir, name), current = null;
			try { current = await Zotero.File.getContentsAsync(path); } catch (e) { /* not installed yet */ }
			if (current === source) continue;
			await Zotero.File.putContentsAsync(path, source);
			changed = true;
		}
		catch (e) { Zotero.logError(e); }
	}
	if (changed) await Zotero.Translators.reinit();
}

function shutdown() {}
function install() {}

// Zotero also calls uninstall() on the old version during an upgrade (reason 7) or downgrade (8);
// only remove the translators when the plugin is really being removed (6).
async function uninstall(data, reason) {
	if (reason !== 6) return;
	await Zotero.initializationPromise;
	try {
		let dir = Zotero.getTranslatorsDirectory().path;
		for (let name of TRANSLATORS) await IOUtils.remove(PathUtils.join(dir, name), { ignoreAbsent: true });
		await Zotero.Translators.reinit();
	}
	catch (e) { Zotero.logError(e); }
}

function onMainWindowLoad() {}
function onMainWindowUnload() {}
