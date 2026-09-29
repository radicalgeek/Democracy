#!/usr/bin/env sh
set -eu

root="$(git rev-parse --show-toplevel)"
cd "$root"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
mkdir -p "$scratch/bin"

cat >"$scratch/bin/npm" <<'FAKE'
#!/usr/bin/env sh
case "$*" in
  "--prefix modern-democracy run lint"|"--prefix modern-democracy/server run lint"|"--prefix modern-democracy/server run build"|"--prefix modern-democracy audit --omit=dev --audit-level=moderate"|"--prefix modern-democracy/server audit --omit=dev --audit-level=moderate") exit 0 ;;
  "--prefix modern-democracy run build") exit 17 ;;
  *) echo "unexpected npm command: $*" >&2; exit 99 ;;
esac
FAKE
chmod +x "$scratch/bin/npm"

PATH="$scratch/bin:$PATH" DEMOCRACY_TELEMETRY_SPOOL_ROOT="$scratch/spool" \
  DEMOCRACY_TEST_TELEMETRY_RELAY_URL= DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN_FILE= \
  CI_PUSHGATEWAY_URL="http://127.0.0.1:9" CI_TEST_TELEMETRY_TOKEN="unused-test-token" \
  scripts/run-hooks.sh pre-commit

if PATH="$scratch/bin:$PATH" DEMOCRACY_TELEMETRY_SPOOL_ROOT="$scratch/spool" \
  DEMOCRACY_TEST_TELEMETRY_RELAY_URL= DEMOCRACY_TELEMETRY_PRE_MERGE_TOKEN_FILE= \
  scripts/run-hooks.sh pre-merge; then
  echo 'expected the failing frontend build gate to retain its exit status' >&2
  exit 1
else
  status=$?
fi
[ "$status" -eq 17 ] || { echo "expected exit status 17, got $status" >&2; exit 1; }

python3 - "$scratch/spool" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
records = {
    stage: [json.loads(path.read_text()) for path in (root / stage).glob("*.json")]
    for stage in ("pre-commit", "pre-merge")
}
commit_suites = {item["group"]["suite"] for item in records["pre-commit"]}
assert commit_suites == {"frontend_typecheck", "server_typecheck"}, commit_suites
for item in records["pre-commit"]:
    assert item["group"]["project"] == "democracy"
    assert item["group"]["hook_stage"] == "pre_commit"
    assert item["summary"]["git"]["tested_sha"] == item["summary"]["git"]["index_tree_sha"]
merge_suites = {item["group"]["suite"] for item in records["pre-merge"]}
assert merge_suites == {
    "frontend_typecheck", "frontend_build", "server_typecheck", "server_build",
    "frontend_audit", "server_audit",
}, merge_suites
build = next(item for item in records["pre-merge"] if item["group"]["suite"] == "frontend_build")
assert build["summary"]["command_exit_code"] == 17
assert build["group"]["hook_stage"] == "pre_merge"
PY

echo 'Democracy hook telemetry dry-run passed'
