# Push-left check telemetry

Democracy's Git hooks run the delivery gates before a remote push. The hook at
`scripts/run-hooks.sh` publishes each executed check with the vendored AxiaCraft
publisher `scripts/ci/publish_test_telemetry.py`, copied from source commit
`f1047173454b35d5c9d248e877deb82bc7b425e3`. Its SHA-256 is recorded in
`scripts/ci/publish_test_telemetry.sha256` and verified on each hook run. The
publisher uses Python 3.12+ and the standard library.

| Stage | Executed gates | Telemetry suites |
| --- | --- | --- |
| Developer pre-commit | Frontend and server TypeScript lint | `frontend_typecheck`, `server_typecheck` |
| Merge-agent pre-merge | Existing frontend and server lint/build, plus the npm security audits already required in GitHub CI | `frontend_typecheck`, `frontend_build`, `server_typecheck`, `server_build`, `frontend_audit`, `server_audit` |
| PM pre-push | Same gates on the reviewed integration commit | Same suites under a separate hook stage |

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

## Relay credentials and offline spool

Set `DEMOCRACY_TEST_TELEMETRY_RELAY_URL` to the authorised HTTPS relay after
the Democracy project and stage tokens are provisioned. The intended URL is
`https://ci-telemetry.radicalgeek.co.uk`. Give each role only its own
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

The GitHub workflow still performs its own checks before image build and
in-cluster deployment. It does not publish telemetry while the authenticated
relay is being provisioned.
