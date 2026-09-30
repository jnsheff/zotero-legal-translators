#!/bin/sh
# 1. translators/ is up to date with src/  2. citation parsing (jsc)  3. both translators against the
# fixtures in headless Chrome (needs Google Chrome; skipped with a warning if absent).
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fail=0
python3 build.py --check && echo "build OK (translators/ matches src/)" || fail=1
out=$("$JSC" test/parse-jsc.js 2>&1); echo "$out" | tail -5; echo "$out" | grep -q '^parse OK' || fail=1
if [ -x "$CHROME" ]; then
	PORT=$((20000 + $$ % 20000))
	python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
	sleep 1
	dom=$("$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:$PORT/test/harness.html" 2>/dev/null)
	kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
	echo "$dom" | python3 -c "import sys,re,html;m=re.search(r'<pre id=.out.>(.*?)</pre>',sys.stdin.read(),re.S);print(html.unescape(m.group(1)) if m else 'no output')"
	echo "$dom" | grep -q '<pre id="out">HARNESS OK' || fail=1
else
	echo "WARNING: Google Chrome not found; open test/harness.html over http (python3 -m http.server) to run the DOM tests"
fi
[ $fail -eq 0 ] && echo "ALL TESTS PASSED" || echo "TESTS FAILED"
exit $fail
