#!/usr/bin/env python3
"""Publish JUnit and command-check results from hooks or CI to Prometheus.

The grouping key contains configured job/project/suite/ref/hook_stage values.
Run, commit, worktree and test identifiers never enter Prometheus labels.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

MAX_REPORT_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_SPOOL_ITEMS = 100
MAX_SPOOL_BYTES = 1024 * 1024
VERSION = "1.0.0"
KEY_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,63}$")
RETRY_TAGS = {"flakyFailure", "flakyError", "rerunFailure", "rerunError"}
OUTCOMES = ("passed", "failed", "error", "skipped")
HOOK_STAGES = ("pre_commit", "pre_merge", "pre_push", "remote_ci")
PLATFORMS = ("web", "ios", "android", "desktop", "mixed", "other")
DEVICE_CLASSES = ("browser", "simulator", "emulator", "physical", "mixed", "other")


class ReportError(ValueError):
    """A report is missing, malformed, or not a JUnit report."""


class StaleTelemetry(RuntimeError):
    """The authenticated relay already accepted a newer result for this group."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Keep bearer credentials on the configured relay origin."""

    def redirect_request(
        self,
        request: urllib.request.Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> None:
        return None


@dataclass
class Result:
    report_files: int = 0
    cases: int = 0
    passed: int = 0
    failed: int = 0
    error: int = 0
    skipped: int = 0
    retried: int = 0
    duration_seconds: float = 0.0
    timed_cases: int = 0


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _finite_duration(value: str | None, path: Path) -> float | None:
    if value is None:
        return None
    try:
        duration = float(value)
    except ValueError as exc:
        raise ReportError(f"{path}: invalid testcase duration") from exc
    if duration < 0 or not math.isfinite(duration):
        raise ReportError(f"{path}: invalid testcase duration")
    return duration


def report_paths(patterns: Sequence[str]) -> list[Path]:
    paths: set[Path] = set()
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if not matches:
            raise ReportError(f"no report matched pattern: {pattern}")
        paths.update(Path(match).resolve() for match in matches if Path(match).is_file())
    if not paths:
        raise ReportError("no report files found")
    if sum(path.stat().st_size for path in paths) > MAX_TOTAL_BYTES:
        raise ReportError("total report size exceeds 128 MiB")
    return sorted(paths)


def parse_reports(paths: Sequence[Path]) -> Result:
    result = Result()
    for path in paths:
        data = path.read_bytes()
        if len(data) > MAX_REPORT_BYTES:
            raise ReportError(f"{path}: report exceeds 32 MiB")
        # ElementTree does not fetch external entities, but reject declarations
        # outright so untrusted CI artifacts have a narrow XML format.
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            raise ReportError(f"{path}: XML declarations for DTD/entities are forbidden")
        try:
            root = ET.fromstring(data)
        except ET.ParseError as exc:
            raise ReportError(f"{path}: invalid XML: {exc}") from exc
        if _local_name(root.tag) not in {"testsuite", "testsuites"}:
            raise ReportError(f"{path}: expected testsuite or testsuites root")
        cases = [node for node in root.iter() if _local_name(node.tag) == "testcase"]
        if not cases:
            # An intentionally empty suite is valid; a report claiming tests
            # without testcase elements would otherwise look like a green run.
            for suite in root.iter():
                if _local_name(suite.tag) == "testsuite" and int(suite.get("tests", "0")) > 0:
                    raise ReportError(f"{path}: testsuite claims tests but has no testcases")
            if _local_name(root.tag) == "testsuites" and int(root.get("tests", "0")) > 0:
                raise ReportError(f"{path}: testsuites claims tests but has no testcases")
        result.report_files += 1
        for case in cases:
            result.cases += 1
            child_tags = {_local_name(child.tag) for child in case}
            if "error" in child_tags:
                result.error += 1
            elif "failure" in child_tags:
                result.failed += 1
            elif "skipped" in child_tags:
                result.skipped += 1
            else:
                result.passed += 1
            retry_value = case.get("rerun") or case.get("retries") or ""
            if child_tags & RETRY_TAGS or retry_value.lower() not in {"", "0", "false", "no"}:
                result.retried += 1
            duration = _finite_duration(case.get("time"), path)
            if duration is not None:
                result.duration_seconds += duration
                result.timed_cases += 1
    return result


def detect_ci_context() -> dict[str, str]:
    env = os.environ
    if env.get("GITHUB_ACTIONS") == "true":
        server = env.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
        repo = env.get("GITHUB_REPOSITORY", "")
        run_id = env.get("GITHUB_RUN_ID", "")
        return {
            "provider": "github",
            "run_id": run_id,
            "run_url": f"{server}/{repo}/actions/runs/{run_id}" if repo and run_id else "",
            "commit_sha": env.get("GITHUB_SHA", ""),
            "branch": env.get("GITHUB_REF_NAME", ""),
        }
    if env.get("GITLAB_CI") == "true":
        return {
            "provider": "gitlab",
            "run_id": env.get("CI_PIPELINE_ID", ""),
            "run_url": env.get("CI_PIPELINE_URL", ""),
            "commit_sha": env.get("CI_COMMIT_SHA", ""),
            "branch": env.get("CI_COMMIT_REF_NAME", ""),
        }
    if env.get("TF_BUILD") == "True" or env.get("TF_BUILD") == "true":
        run_id = env.get("BUILD_BUILDID", "")
        collection = env.get("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI", "").rstrip("/")
        project = urllib.parse.quote(env.get("SYSTEM_TEAMPROJECT", ""), safe="")
        run_url = f"{collection}/{project}/_build/results?buildId={run_id}"
        return {
            "provider": "ado",
            "run_id": run_id,
            "run_url": run_url if collection and project and run_id else "",
            "commit_sha": env.get("BUILD_SOURCEVERSION", ""),
            "branch": env.get("BUILD_SOURCEBRANCHNAME", ""),
        }
    return {"provider": "other", "run_id": "", "run_url": "", "commit_sha": "", "branch": ""}


def git_provenance(tested_sha: str | None, worktree: str | None) -> dict[str, str]:
    def git_value(*args: str) -> str:
        try:
            return subprocess.check_output(
                ["git", *args], stderr=subprocess.DEVNULL, text=True, timeout=2
            ).strip()
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return ""

    head_sha = git_value("rev-parse", "HEAD")
    return {
        "tested_sha": tested_sha or head_sha,
        "head_sha": head_sha,
        "index_tree_sha": git_value("write-tree"),
        "worktree": worktree or git_value("rev-parse", "--show-toplevel"),
    }


def _metric(name: str, value: float, labels: dict[str, str] | None = None) -> str:
    if not labels:
        return f"{name} {value}\n"
    quoted = ",".join(f"{key}={json.dumps(label)}" for key, label in labels.items())
    return f"{name}{{{quoted}}} {value}\n"


def render_metrics(
    result: Result,
    *,
    valid: bool,
    report_required: bool = True,
    command_exit_code: int,
    timestamp: float,
    provider: str,
    intent: str,
    test_type: str,
    platform: str = "other",
    device_class: str = "other",
) -> bytes:
    labels = {
        "provider": provider,
        "intent": intent,
        "test_type": test_type,
        "platform": platform,
        "device_class": device_class,
    }
    lines = [
        # Keep the existing Hoofer/PeakQuest dashboard contract intact for JUnit.
        "# TYPE ci_test_report_present gauge\n",
        _metric("ci_test_report_present", int(valid)),
        "# TYPE ci_test_report_required gauge\n",
        _metric("ci_test_report_required", int(report_required)),
        "# TYPE ci_test_cases gauge\n",
        _metric("ci_test_cases", result.passed, {"result": "passed"}),
        _metric("ci_test_cases", result.failed + result.error, {"result": "failed"}),
        _metric("ci_test_cases", result.skipped, {"result": "skipped"}),
        "# TYPE ci_test_duration_seconds gauge\n",
        _metric("ci_test_duration_seconds", round(result.duration_seconds, 6)),
        # Further dimensions remain bounded and use separate metric names.
        "# TYPE ci_test_report_valid gauge\n",
        _metric("ci_test_report_valid", int(valid), labels),
        "# TYPE ci_test_report_files gauge\n",
        _metric("ci_test_report_files", result.report_files, labels),
        "# TYPE ci_test_command_exit_code gauge\n",
        _metric("ci_test_command_exit_code", command_exit_code, labels),
        "# TYPE ci_test_command_passed gauge\n",
        _metric("ci_test_command_passed", int(command_exit_code == 0), labels),
        "# TYPE ci_check_passed gauge\n",
        _metric("ci_check_passed", int(command_exit_code == 0), labels),
        "# TYPE ci_test_cases_by_outcome gauge\n",
    ]
    if report_required:
        lines.extend(
            [
                "# TYPE ci_test_last_run_unixtime_seconds gauge\n",
                _metric("ci_test_last_run_unixtime_seconds", timestamp),
            ]
        )
    else:
        lines.extend(
            [
                "# TYPE ci_check_last_run_unixtime_seconds gauge\n",
                _metric("ci_check_last_run_unixtime_seconds", timestamp, labels),
            ]
        )
    for outcome in OUTCOMES:
        lines.append(
            _metric(
                "ci_test_cases_by_outcome", getattr(result, outcome), {**labels, "outcome": outcome}
            )
        )
    lines.extend(
        [
            "# TYPE ci_test_retried_cases gauge\n",
            _metric("ci_test_retried_cases", result.retried, labels),
            "# TYPE ci_test_case_duration_seconds_sum gauge\n",
            _metric("ci_test_case_duration_seconds_sum", round(result.duration_seconds, 6), labels),
            "# TYPE ci_test_timed_cases gauge\n",
            _metric("ci_test_timed_cases", result.timed_cases, labels),
        ]
    )
    return "".join(lines).encode("utf-8")


def gateway_group_url(
    base: str, project: str, job: str, suite: str, ref: str, hook_stage: str | None = "remote_ci"
) -> str:
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("gateway URL must be an HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("gateway URL must not contain credentials, query, or fragment")
    for key, value in {"project": project, "job": job, "suite": suite, "ref": ref}.items():
        if not KEY_PATTERN.fullmatch(value):
            raise ValueError(f"{key} must be a configured identifier of at most 64 characters")
    if ref not in {"default", "other", "tag"}:
        raise ValueError("ref must be default, other, or tag")
    if hook_stage is not None and hook_stage not in HOOK_STAGES:
        raise ValueError("hook_stage must be a known gate stage")
    path = f"/metrics/job/{urllib.parse.quote(job, safe='')}"
    for key, value in (("project", project), ("suite", suite), ("ref", ref)):
        path += f"/{key}/{urllib.parse.quote(value, safe='')}"
    if hook_stage is not None:
        path += f"/hook_stage/{hook_stage}"
    return base.rstrip("/") + path


def detect_ref(default_branch: str | None) -> str:
    env = os.environ
    if (
        env.get("CI_COMMIT_TAG")
        or env.get("GITHUB_REF_TYPE") == "tag"
        or env.get("BUILD_SOURCEBRANCH", "").startswith("refs/tags/")
    ):
        return "tag"
    branch = (
        env.get("CI_COMMIT_BRANCH")
        or env.get("GITHUB_REF_NAME")
        or env.get("BUILD_SOURCEBRANCHNAME")
    )
    default = default_branch or env.get("CI_DEFAULT_BRANCH")
    return "default" if branch and default and branch == default else "other"


def gateway_request(
    url: str,
    method: str,
    body: bytes | None,
    token_env: str | None,
    token_file: str | None = None,
    observed_at_ns: int | None = None,
) -> None:
    headers = {"User-Agent": "axiacraft-test-telemetry/1"}
    if body is not None:
        headers["Content-Type"] = "text/plain; version=0.0.4; charset=utf-8"
    if method == "PUT" and observed_at_ns is not None:
        headers["X-CI-Telemetry-Observed-At-Ns"] = str(observed_at_ns)
    if token_env and token_file:
        raise ValueError("choose either bearer token environment variable or file")
    parsed = urllib.parse.urlparse(url)
    if (token_env or token_file) and not (
        parsed.scheme == "https"
        or (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"})
    ):
        raise ValueError("bearer telemetry delivery requires HTTPS except for loopback")
    if token_env:
        token = os.environ.get(token_env)
        if not token:
            raise ValueError(f"bearer token environment variable {token_env} is not set")
        headers["Authorization"] = f"Bearer {token}"
    if token_file:
        token = Path(token_file).read_text(encoding="utf-8").strip()
        if not token:
            raise ValueError("bearer token file is empty")
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        if token_env or token_file:
            response_context = urllib.request.build_opener(NoRedirect()).open(request, timeout=5)
        else:
            response_context = urllib.request.urlopen(request, timeout=5)
        with response_context as response:
            response.read(1)
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            raise StaleTelemetry("relay already accepted a newer result") from exc
        raise RuntimeError(f"Pushgateway returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Pushgateway transport error: {exc.reason}") from exc


def spool_record(
    directory: str, group: dict[str, str], body: bytes, summary: dict[str, object]
) -> Path:
    folder = Path(directory)
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    if folder.stat().st_mode & 0o077:
        raise ValueError("spool directory must not be accessible by group or others")
    records = list(folder.glob("*.json"))
    if len(records) >= MAX_SPOOL_ITEMS:
        raise ValueError("telemetry spool is full (100 records)")
    payload = json.dumps({"group": group, "metrics": body.decode("utf-8"), "summary": summary})
    if len(payload.encode("utf-8")) > MAX_SPOOL_BYTES:
        raise ValueError("telemetry spool record exceeds 1 MiB")
    descriptor, path = tempfile.mkstemp(
        prefix=f"{int(time.time()):010d}-", suffix=".json", dir=folder
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(payload + "\n")
    except BaseException:
        Path(path).unlink(missing_ok=True)
        raise
    return Path(path)


def flush_spool(args: argparse.Namespace) -> int:
    if not args.bearer_token_env and not args.bearer_token_file:
        raise ValueError("flush requires an authenticated monotonic relay")
    folder = Path(args.spool_dir)
    if not folder.exists():
        print("test telemetry: spool is empty")
        return 0
    if folder.stat().st_mode & 0o077:
        raise ValueError("spool directory must not be accessible by group or others")
    paths = sorted(folder.glob("*.json"))
    if len(paths) > MAX_SPOOL_ITEMS:
        raise ValueError("telemetry spool exceeds 100 records")
    flushed = 0
    superseded = 0
    for path in paths:
        if path.stat().st_size > MAX_SPOOL_BYTES:
            raise ValueError(f"{path}: spool record exceeds 1 MiB")
        record = json.loads(path.read_text(encoding="utf-8"))
        group = record["group"]
        body = record["metrics"].encode("utf-8")
        observed_at_ns = int(record["summary"]["observed_at_ns"])
        url = gateway_group_url(
            args.gateway_url,
            group["project"],
            group["job"],
            group["suite"],
            group["ref"],
            group["hook_stage"],
        )
        try:
            gateway_request(
                url, "PUT", body, args.bearer_token_env, args.bearer_token_file, observed_at_ns
            )
            flushed += 1
        except StaleTelemetry:
            superseded += 1
            print(f"test telemetry: discarded superseded spool record {path}")
        path.unlink()
    print(f"test telemetry: flushed {flushed}, superseded {superseded} spool records")
    return 0


def publish(args: argparse.Namespace) -> int:
    if not KEY_PATTERN.fullmatch(args.test_type):
        raise ValueError("test_type must be a configured identifier of at most 64 characters")
    context = detect_ci_context()
    ref = args.ref or detect_ref(args.default_branch)
    result = Result()
    report_error: str | None = None
    if not args.command_only:
        try:
            result = parse_reports(report_paths(args.report))
        except (ReportError, OSError, ValueError) as exc:
            report_error = str(exc)
            print(f"test telemetry: {report_error}", file=sys.stderr)
    valid = report_error is None and not args.command_only
    exit_code = args.test_exit_code
    if exit_code is None:
        exit_code = int(bool(report_error or result.failed or result.error))
    observed_at_ns = time.time_ns()
    now = observed_at_ns / 1_000_000_000
    summary: dict[str, object] = {
        "project": args.project,
        "suite": args.suite,
        "test_type": args.test_type,
        "job": args.job,
        "ref": ref,
        "intent": args.intent,
        "hook_stage": args.hook_stage,
        "platform": args.platform,
        "device_class": args.device_class,
        "report_required": not args.command_only,
        "timestamp_seconds": now,
        "observed_at_ns": observed_at_ns,
        "report_valid": valid,
        "report_error": report_error,
        "command_exit_code": exit_code,
        "result": asdict(result),
        "ci": context,
        "git": git_provenance(args.tested_sha or context["commit_sha"], args.worktree),
    }
    if args.summary_output:
        Path(args.summary_output).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    metrics = render_metrics(
        result,
        valid=valid,
        report_required=not args.command_only,
        command_exit_code=exit_code,
        timestamp=now,
        provider=context["provider"],
        intent=args.intent,
        test_type=args.test_type,
        platform=args.platform,
        device_class=args.device_class,
    )
    group = {
        "project": args.project,
        "job": args.job,
        "suite": args.suite,
        "ref": ref,
        "hook_stage": args.hook_stage,
    }
    delivery = "published"
    if args.gateway_url:
        try:
            url = gateway_group_url(
                args.gateway_url, args.project, args.job, args.suite, ref, args.hook_stage
            )
            gateway_request(
                url, "PUT", metrics, args.bearer_token_env, args.bearer_token_file, observed_at_ns
            )
        except StaleTelemetry:
            delivery = "superseded"
            print(
                f"test telemetry: relay already has a newer result for {args.project}/{args.suite}",
                file=sys.stderr,
            )
        except (OSError, RuntimeError, ValueError) as exc:
            if not args.spool_dir:
                raise
            path = spool_record(args.spool_dir, group, metrics, summary)
            delivery = "spooled"
            print(
                f"test telemetry: delivery unavailable ({exc}); spooled to {path}", file=sys.stderr
            )
    elif args.spool_dir:
        path = spool_record(args.spool_dir, group, metrics, summary)
        delivery = "spooled"
        print(f"test telemetry: spooled to {path}")
    else:
        raise ValueError("--gateway-url or --spool-dir is required")
    if args.command_only:
        print(f"test telemetry: {delivery} command-only check for {args.project}/{args.suite}")
    elif report_error:
        print(f"test telemetry: {delivery} missing-report signal for {args.project}/{args.suite}")
    else:
        print(
            f"test telemetry: {delivery} {result.cases} cases from {result.report_files} reports "
            f"for {args.project}/{args.suite} ({context['provider']})"
        )
    return 2 if report_error else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="version", version=VERSION)
    subparsers = parser.add_subparsers(dest="action", required=True)
    flush = subparsers.add_parser("flush", help="replay bounded local spool records")
    flush.add_argument("--gateway-url", default=os.environ.get("CI_PUSHGATEWAY_URL"))
    flush.add_argument("--spool-dir", required=True)
    flush.add_argument(
        "--bearer-token-env",
        default="CI_TEST_TELEMETRY_TOKEN" if os.environ.get("CI_TEST_TELEMETRY_TOKEN") else None,
    )
    flush.add_argument("--bearer-token-file")
    for action in ("publish", "run", "delete"):
        command = subparsers.add_parser(action)
        command.add_argument("--gateway-url", default=os.environ.get("CI_PUSHGATEWAY_URL"))
        command.add_argument("--project", required=True)
        command.add_argument("--job", default="check")
        command.add_argument("--suite", required=True)
        command.add_argument("--test-type", required=True)
        command.add_argument("--ref", choices=("default", "other", "tag"))
        command.add_argument("--hook-stage", choices=HOOK_STAGES, default="remote_ci")
        command.add_argument(
            "--default-branch", help="used to classify the CI ref when --ref is omitted"
        )
        command.add_argument(
            "--bearer-token-env",
            default=(
                "CI_TEST_TELEMETRY_TOKEN" if os.environ.get("CI_TEST_TELEMETRY_TOKEN") else None
            ),
        )
        command.add_argument("--bearer-token-file")
        if action != "delete":
            command.add_argument(
                "--spool-dir", default=os.environ.get("CI_TEST_TELEMETRY_SPOOL_DIR")
            )
            command.add_argument("--tested-sha", help="exact commit or tree SHA tested by the hook")
            command.add_argument("--worktree", help="tested checkout path for the JSON artifact")
            command.add_argument("--platform", choices=PLATFORMS, default="other")
            command.add_argument("--device-class", choices=DEVICE_CLASSES, default="other")
            command.add_argument(
                "--report", action="append", default=[], help="JUnit XML path or glob"
            )
            command.add_argument("--command-only", action="store_true")
            command.add_argument(
                "--intent", choices=("verification", "expected_failure"), default="verification"
            )
            command.add_argument(
                "--summary-output", help="write run metadata and result to a JSON artifact"
            )
            command.add_argument("--test-exit-code", type=int)
        if action == "run":
            command.add_argument("test_command", nargs=argparse.REMAINDER)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.action in {"delete", "flush"} and not args.gateway_url:
        parser.error("--gateway-url or CI_PUSHGATEWAY_URL is required")
    if args.action == "flush":
        try:
            return flush_spool(args)
        except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
            print(f"test telemetry flush failed: {exc}", file=sys.stderr)
            return 2
    if args.action != "delete":
        if args.command_only and args.report:
            parser.error("--command-only cannot be combined with --report")
        if not args.command_only and not args.report:
            parser.error("--report is required unless --command-only is set")
        if args.action == "publish" and args.command_only and args.test_exit_code is None:
            parser.error("--command-only publish requires --test-exit-code")
        if not args.gateway_url and not args.spool_dir:
            parser.error("--gateway-url or --spool-dir is required")
    try:
        if args.action == "delete":
            ref = args.ref or detect_ref(args.default_branch)
            url = gateway_group_url(
                args.gateway_url, args.project, args.job, args.suite, ref, args.hook_stage
            )
            gateway_request(url, "DELETE", None, args.bearer_token_env, args.bearer_token_file)
            print(f"test telemetry: deleted {args.project}/{args.suite} grouping")
            return 0
        if args.action == "run":
            command = args.test_command
            if command and command[0] == "--":
                command = command[1:]
            if not command:
                parser.error("run requires a command after --")
            try:
                args.test_exit_code = subprocess.call(command)
            except OSError as exc:
                print(f"test command could not start: {exc}", file=sys.stderr)
                args.test_exit_code = 127
            try:
                publish(args)
            except (OSError, RuntimeError, ValueError) as exc:
                print(f"test telemetry publication failed: {exc}", file=sys.stderr)
            return args.test_exit_code
        return publish(args)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"test telemetry publication failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
