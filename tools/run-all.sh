#!/bin/bash
# 모든 점검을 차례로 실행: bash tools/run-all.sh
cd "$(dirname "$0")/.."
status=0
for step in "python3 tools/check.py" "node tools/test-stars.js" "node tools/test-index.js" "node tools/test-word.js" \
            "node tools/test-math.js" "node tools/test-clock.js" "node tools/test-match.js" "node tools/test-file.js" \
            "node tools/test-screens.js" "node tools/test-extra.js" "node tools/list-texts.js"; do
  out=$($step 2>&1); code=$?
  [ $code -ne 0 ] && status=1
  printf '%-32s %s\n' "$step" "$( [ $code -eq 0 ] && echo "통과 — $(echo "$out" | tail -1)" || echo "실패")"
  [ $code -ne 0 ] && echo "$out" | grep -E '실패' | head -10
done
exit $status
