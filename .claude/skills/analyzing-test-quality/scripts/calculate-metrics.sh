#!/bin/bash
# Test Quality Metrics Calculator
# Reports metrics for the same Jest unit-test scope used by CI.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../../../../" && pwd)
JEST_BIN="$PROJECT_ROOT/node_modules/.bin/jest"
CI_TEST_PATTERN='^(?!.*test/native-build-(baseline|artifact)[.]test[.]ts$).*'

if [ ! -x "$JEST_BIN" ]; then
  echo "Jest wurde nicht gefunden: $JEST_BIN" >&2
  exit 1
fi

cd "$PROJECT_ROOT"

TEST_FILES=()
JEST_SCOPE_OUTPUT=$("$JEST_BIN" \
  --config "$PROJECT_ROOT/jest.config.js" \
  --listTests \
  --runInBand \
  --testPathPattern="$CI_TEST_PATTERN")
while IFS= read -r file; do
  [ -n "$file" ] && TEST_FILES+=("$file")
done <<< "$JEST_SCOPE_OUTPUT"

if [ "${#TEST_FILES[@]}" -eq 0 ]; then
  echo "Jest hat keine Unit-Testdateien im CI-Scope gefunden." >&2
  exit 1
fi

count_lines() {
  local total=0
  local file
  for file in "$@"; do
    total=$((total + $(wc -l < "$file")))
  done
  printf '%s' "$total"
}

count_matching_files() {
  local pattern="$1"
  shift
  local count=0
  local file
  for file in "$@"; do
    if rg -q --pcre2 "$pattern" "$file"; then
      count=$((count + 1))
    fi
  done
  printf '%s' "$count"
}

json_value() {
  local path="$1"
  node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const [root, key] = process.argv[1].split(":", 2);
      const report = JSON.parse(input);
      console.log(key === undefined ? report[root] : report[root][key]);
    });
  ' "$path" <<< "$ANALYSIS_JSON"
}

SOURCE_FILES=()
SOURCE_FILE_OUTPUT=$(rg --files src \
  -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' \
  | rg -v '\.(test|spec)\.[jt]sx?$' || true)
while IFS= read -r file; do
  [ -n "$file" ] && SOURCE_FILES+=("$PROJECT_ROOT/$file")
done <<< "$SOURCE_FILE_OUTPUT"

TEST_LINES=$(count_lines "${TEST_FILES[@]}")
SOURCE_LINES=$(count_lines "${SOURCE_FILES[@]}")
TEST_FILE_COUNT=${#TEST_FILES[@]}
SOURCE_FILE_COUNT=${#SOURCE_FILES[@]}

if [ "$SOURCE_FILE_COUNT" -gt 0 ]; then
  TEST_FILE_RATIO=$(awk -v tests="$TEST_FILE_COUNT" -v source="$SOURCE_FILE_COUNT" 'BEGIN { printf "%.2f", tests / source }')
else
  TEST_FILE_RATIO='N/A'
fi

if [ "$SOURCE_LINES" -gt 0 ]; then
  TEST_LINE_RATIO=$(awk -v tests="$TEST_LINES" -v source="$SOURCE_LINES" 'BEGIN { printf "%.2f", tests / source }')
else
  TEST_LINE_RATIO='N/A'
fi

ANALYSIS_JSON=$(bun "$PROJECT_ROOT/scripts/analyze-test-declarations.ts" "${TEST_FILES[@]}")
TOTAL_TESTS=$(json_value testDeclarations)
DESCRIBE_BLOCKS=$(json_value describeBlocks)
ONLY_MARKERS=$(json_value 'markers:.only')
SKIP_MARKERS=$(json_value 'markers:.skip')
FIT_MARKERS=$(json_value 'markers:fit')
FDESCRIBE_MARKERS=$(json_value 'markers:fdescribe')
XIT_MARKERS=$(json_value 'markers:xit')
XDESCRIBE_MARKERS=$(json_value 'markers:xdescribe')

BEFORE_EACH=$(count_matching_files '\bbeforeEach\b' "${TEST_FILES[@]}")
MOCKS=$(count_matching_files '\b(jest|vi)\.mock\s*\(' "${TEST_FILES[@]}")
ASYNC_TESTS=$(count_matching_files '\b(async|await|resolves|rejects)\b' "${TEST_FILES[@]}")
TIMEOUTS=$(count_matching_files '\bsetTimeout\s*\(' "${TEST_FILES[@]}")

echo "📊 Test Quality Metrics"
echo "======================="
echo
echo "Scope"
echo "-----"
echo "CI unit command: bun run test -- --testPathPattern='$CI_TEST_PATTERN'"
echo "Jest config: jest.config.js"
echo "Test discovery: Jest --listTests --runInBand"
echo "Test input files: $TEST_FILE_COUNT"
echo "Production source scope: src/ ($SOURCE_FILE_COUNT files)"
echo
echo "CI unit input files"
echo "-------------------"
for file in "${TEST_FILES[@]}"; do
  printf '%s\n' "${file#"$PROJECT_ROOT"/}"
done
echo
echo "Metrics"
echo "-------"
printf '%-25s %s\n' 'Test Files:' "$TEST_FILE_COUNT"
printf '%-25s %s\n' 'Source Files:' "$SOURCE_FILE_COUNT"
printf '%-25s %s\n' 'Test File Ratio:' "$TEST_FILE_RATIO"
printf '%-25s %s\n' 'Test Lines:' "$TEST_LINES"
printf '%-25s %s\n' 'Source Lines:' "$SOURCE_LINES"
printf '%-25s %s\n' 'Test Line Ratio:' "$TEST_LINE_RATIO"
printf '%-25s %s\n' 'Test Declarations:' "$TOTAL_TESTS"
printf '%-25s %s\n' 'Describe Blocks:' "$DESCRIBE_BLOCKS"
echo
echo "Marker-Prüfung"
echo "--------------"
printf '%-25s %s\n' '.only:' "$ONLY_MARKERS"
printf '%-25s %s\n' '.skip:' "$SKIP_MARKERS"
printf '%-25s %s\n' 'fit:' "$FIT_MARKERS"
printf '%-25s %s\n' 'fdescribe:' "$FDESCRIBE_MARKERS"
printf '%-25s %s\n' 'xit:' "$XIT_MARKERS"
printf '%-25s %s\n' 'xdescribe:' "$XDESCRIBE_MARKERS"

MARKER_TOTAL=$((ONLY_MARKERS + SKIP_MARKERS + FIT_MARKERS + FDESCRIBE_MARKERS + XIT_MARKERS + XDESCRIBE_MARKERS))
if [ "$MARKER_TOTAL" -gt 0 ]; then
  echo
  echo "Marker-Dateien"
  echo "--------------"
  node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const report = JSON.parse(input);
      for (const file of report.files) {
        const markers = Object.entries(file.markers).filter(([, count]) => count > 0);
        if (markers.length > 0) {
          console.log(`${file.file}: ${markers.map(([name, count]) => `${name}=${count}`).join(", ")}`);
        }
      }
    });
  ' <<< "$ANALYSIS_JSON"
fi

echo
echo "Pattern Analysis"
echo "-----------------"
printf '%-25s %s\n' 'Setup hooks:' "$BEFORE_EACH files"
printf '%-25s %s\n' 'Mocking:' "$MOCKS files"
printf '%-25s %s\n' 'Async tests:' "$ASYNC_TESTS files"
printf '%-25s %s\n' 'setTimeout files:' "$TIMEOUTS"
echo
echo "Known heuristic boundaries"
echo "--------------------------"
echo "- Jest discovery is authoritative for the listed CI unit scope."
echo "- TypeScript AST matching ignores comments and string literals."
echo "- Only statically named Jest calls (it/test/describe and supported variants) are counted."
echo "- Computed properties, aliases and dynamically generated test calls are not inferred."
echo "- Marker findings are report-only; this helper never changes or skips tests."
