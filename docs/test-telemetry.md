# Push-left check telemetry

Democracy's Git hooks run the delivery gates before a remote push. The hook at
`scripts/run-hooks.sh` publishes each executed check with the vendored AxiaCraft
publisher `scripts/ci/publish_test_telemetry.py`, copied from source commit
`410b860cf4a44f7a1d328733743c3b202d210806`. Its SHA-256 is recorded in
`scripts/ci/publish_test_telemetry.sha256` and verified on each hook run. The
publisher uses Python 3.12+ and the standard library.

| Stage | Executed gates | Telemetry suites |
| --- | --- | --- |
| Developer pre-commit | Frontend and server TypeScript lint | `frontend_typecheck`, `server_typecheck` |
| Merge-agent pre-merge | Existing frontend and server lint/build, plus the npm security audits already required in GitHub CI | `frontend_typecheck`, `frontend_build`, `server_typecheck`, `server_build`, `frontend_audit`, `server_audit` |
| PM pre-push | All six gates on a clean, reviewed default-branch HEAD | Same suites under a separate hook stage, each attested to the exact commit |

These are command outcomes. The modern app currently has no executable unit,
integration, browser or mobile test runner and produces no JUnit XML. The
legacy .NET Framework 4.5.1 unit, integration and SpecFlow projects are not
run by the modern hooks or GitHub workflow. Their files are not evidence of
executed tests. The publisher supports JUnit XML when a real test runner is
added; give that runner a stable suite ID and emit its report only after it
actually runs. A setup failure before a report exists should be a command-only
`<suite>_setup` result.

The hook preserves the exit status of the check. Telemetry delivery failures
are visible in hook output but do not replace the check verdict. Provenance is
saved in ignored `test-results/hook-telemetry/`, including the tested commit
or staged tree SHA and worktree path. These identifiers never become metric
labels. Pushgateway groups include `project=democracy`, `job=check`,
`suite`, `ref` and `hook_stage`; one stage cannot overwrite another.
All six pre-merge and pre-push checks run even if an earlier check fails, so
each suite reports its own result. The push remains blocked if any check fails.
The publisher only sends an attestation header when a pre-push result is sent
with a stage credential from a clean default-branch checkout and an explicit
SHA matching HEAD.
The Git pre-push hook also rejects any ref update other than that tested
default-branch HEAD.

## Relay credentials and offline spool

Set `DEMOCRACY_TEST_TELEMETRY_RELAY_URL` to the authorised HTTPS relay. The URL is
`https://grafana.radicalgeek.co.uk/ci-telemetry`. Give each role only its own
credential, as either an environment variable or a file:

| Stage | Environment variable | Token file variable |
| --- | --- | --- |
| `pre-commit` | `DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN` | `DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN_FILE` |
| `pre-merge` | `DEMOCRACY_TELEMETRY_PRE_MERGE_TOKEN` | `DEMOCRACY_TELEMETRY_PRE_MERGE_TOKEN_FILE` |
| `pre-push` | `DEMOCRACY_TELEMETRY_PRE_PUSH_TOKEN` | `DEMOCRACY_TELEMETRY_PRE_PUSH_TOKEN_FILE` |

The hook ignores ambient `CI_TEST_TELEMETRY_TOKEN` and
`CI_PUSHGATEWAY_URL`. It makes no network request unless both the relay URL
and a credential for the current stage are present. Otherwise it writes
bounded records under
`${XDG_STATE_HOME:-$HOME/.local/state}/democracy-test-telemetry/<hook-phase>`.
Override the root with `DEMOCRACY_TELEMETRY_SPOOL_ROOT`. Each record is at
most 1 MiB and each stage retains at most 100 records.

The `master` branch publishes as `ref=default`; feature branches use
`ref=other`. Relay policy must permit `other` for authorised developer
pre-commit tokens if branch telemetry is wanted. Alerts should select
`ref=default`.

Replay one stage's spool using only its stage token:

```sh
python3 scripts/ci/publish_test_telemetry.py flush \
  --spool-dir "$HOME/.local/state/democracy-test-telemetry/pre-commit" \
  --gateway-url "$DEMOCRACY_TEST_TELEMETRY_RELAY_URL" \
  --bearer-token-file "$DEMOCRACY_TELEMETRY_PRE_COMMIT_TOKEN_FILE"
```

The relay rejects superseded snapshots with HTTP 409. Flush discards those
records and retains transport or authorisation failures for investigation.

## Hosted release gate

On a `master` push, GitHub Actions reads the exact `GITHUB_SHA` receipt from the
relay with the `CI_TEST_TELEMETRY_REMOTE_TOKEN` repository secret. The receipt
must confirm all six expected pre-push suites passed for that SHA. A missing,
failing, expired or unverifiable receipt prevents image build and deployment.
The workflow keeps image builds, the in-cluster release, and site/API smoke
tests. Pull requests and manual runs still execute the hosted lint, build and
security audit checks. The receipt endpoint must be deployed before merging
this workflow change; until then, a default-branch push will fail closed.
