#!/usr/bin/env sh
set -eu

phase="${1:-pre-commit}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

git diff --check
git diff --check --cached

publisher="$root/scripts/ci/publish_test_telemetry.py"
publisher_digest="$root/scripts/ci/publish_test_telemetry.sha256"
spool_root="${DEMOCRACY_TELEMETRY_SPOOL_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/democracy-test-telemetry}"
spool_dir="$spool_root/$phase"
relay_url="${DEMOCRACY_TEST_TELEMETRY_RELAY_URL:-}"
telemetry_ready=false

if command -v python3 >/dev/null 2>&1 && python3 - "$publisher" "$publisher_digest" <<'PY'
import hashlib
from pathlib import Path
import sys

publisher, digest_file = map(Path, sys.argv[1:])
expected = digest_file.read_text(encoding="ascii").split()[0]
actual = hashlib.sha256(publisher.read_bytes()).hexdigest()
if actual != expected:
    raise SystemExit("test telemetry publisher checksum mismatch")
PY
then
  telemetry_ready=true
else
  echo "test telemetry unavailable: vendored publisher verification failed" >&2
fi

case "$phase" in
  pre-commit)
    hook_stage=pre_commit
    stage_token="${DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN:-}"
    stage_token_file="${DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN_FILE:-}"
    ;;
  pre-merge)
    hook_stage=pre_merge
    stage_token="${DEMOCRACY_TELEMETRY_PRE_MERGE_TOKEN:-}"
    stage_token_file="${DEMOCRACY_TELEMETRY_PRE_MERGE_TOKEN_FILE:-}"
    ;;
  pre-push)
    hook_stage=pre_push
    stage_token="${DEMOCRACY_TELEMETRY_PRE_PUSH_TOKEN:-}"
    stage_token_file="${DEMOCRACY_TELEMETRY_PRE_PUSH_TOKEN_FILE:-}"
    ;;
  *) echo "unknown hook phase: $phase" >&2; exit 2 ;;
esac

if [ "$phase" = pre-push ]; then
  if [ "$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)" != "${DEMOCRACY_DEFAULT_BRANCH:-master}" ]; then
    echo "pre-push must run on the default branch" >&2
    exit 1
  fi
  if [ -n "$(git status --porcelain=v1 --untracked-files=no --ignore-submodules=none)" ]; then
    echo "pre-push requires a clean tracked worktree at HEAD" >&2
    exit 1
  fi
fi

if [ -n "$stage_token" ] && [ -n "$stage_token_file" ]; then
  echo "test telemetry: use one credential source per hook stage" >&2
  stage_token=""
  stage_token_file=""
fi

branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [ "$branch" = "${DEMOCRACY_DEFAULT_BRANCH:-master}" ]; then
  telemetry_ref=default
else
  telemetry_ref=other
fi

telemetry_emit() (
  suite="$1"
  test_type="$2"
  test_exit="$3"
  [ "$telemetry_ready" = true ] || exit 0

  output_dir="$root/test-results/hook-telemetry"
  mkdir -p "$output_dir"
  set -- python3 "$publisher" publish \
    --project democracy --job check --suite "$suite" \
    --test-type "$test_type" --ref "$telemetry_ref" --hook-stage "$hook_stage" \
    --command-only --test-exit-code "$test_exit" \
    --spool-dir "$spool_dir" --summary-output "$output_dir/$hook_stage-$suite.json"
  if [ "$hook_stage" = pre_commit ]; then
    set -- "$@" --tested-sha "$(git write-tree)"
  else
    set -- "$@" --tested-sha "$(git rev-parse HEAD)"
  fi
  if [ -n "$relay_url" ] && { [ -n "$stage_token" ] || [ -n "$stage_token_file" ]; }; then
    set -- "$@" --gateway-url "$relay_url"
  fi
  if [ -n "$stage_token_file" ]; then
    set -- "$@" --bearer-token-file "$stage_token_file"
  fi

  # Only this hook stage may supply a relay credential. Ignore ambient CI
  # credentials and legacy direct Pushgateway URLs.
  unset CI_TEST_TELEMETRY_TOKEN CI_PUSHGATEWAY_URL
  if [ -n "$stage_token" ]; then
    CI_TEST_TELEMETRY_TOKEN="$stage_token"
    export CI_TEST_TELEMETRY_TOKEN
  fi
  "$@" || echo "test telemetry delivery failed for $hook_stage/$suite" >&2
)

run_gate() {
  suite="$1"
  test_type="$2"
  shift 2
  if "$@"; then
    status=0
  else
    status=$?
  fi
  telemetry_emit "$suite" "$test_type" "$status"
  return "$status"
}

gate_status=0
run_all_gate() {
  if run_gate "$@"; then
    :
  else
    result=$?
    if [ "$gate_status" -eq 0 ]; then
      gate_status=$result
    fi
  fi
}

case "$phase" in
  pre-commit)
    run_all_gate frontend_typecheck static npm --prefix modern-democracy run lint
    run_all_gate server_typecheck static npm --prefix modern-democracy/server run lint
    ;;
  pre-merge|pre-push)
    run_all_gate frontend_typecheck static npm --prefix modern-democracy run lint
    run_all_gate frontend_build build npm --prefix modern-democracy run build
    run_all_gate server_typecheck static npm --prefix modern-democracy/server run lint
    run_all_gate server_build build npm --prefix modern-democracy/server run build
    run_all_gate frontend_audit security npm --prefix modern-democracy audit --omit=dev --audit-level=moderate
    run_all_gate server_audit security npm --prefix modern-democracy/server audit --omit=dev --audit-level=moderate
    ;;
esac

[ "$gate_status" -eq 0 ] || exit "$gate_status"
printf '%s\n' "push-left gate passed: $phase"
