.PHONY: xpi test

# The package is addon/ plus the three built translators
xpi:
	python3 build.py
	rm -rf .stage zotero-legal-translators.xpi
	mkdir -p .stage/translators
	cp addon/manifest.json addon/bootstrap.js .stage/
	cp translators/*.js .stage/translators/
	cd .stage && zip -qr ../zotero-legal-translators.xpi . -x ".*"
	rm -rf .stage

test:
	sh test/run-all.sh
