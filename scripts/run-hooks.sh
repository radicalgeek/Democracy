#!/usr/bin/env sh
set -eu

phase="${1:-pre-commit}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

git diff --check
git diff --check --cached

case "$phase" in
  pre-commit)
    npm --prefix modern-democracy run lint
    npm --prefix modern-democracy/server run lint
    ;;
  pre-merge|pre-push)
    npm --prefix modern-democracy run lint
    npm --prefix modern-democracy run build
    npm --prefix modern-democracy/server run lint
    npm --prefix modern-democracy/server run build
    ;;
  *) echo "unknown hook phase: $phase" >&2; exit 2 ;;
esac

printf '%s\n' "push-left gate passed: $phase"
