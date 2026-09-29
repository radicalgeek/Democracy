#!/usr/bin/env python3
"""Require a fresh, exact-commit pre-push test receipt before deployment."""

import argparse
import json
import math
import os
import re
import ssl
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_BASE_URL = "https://grafana.radicalgeek.co.uk/ci-telemetry"
DEFAULT_TOKEN_ENV = "CI_TEST_TELEMETRY_REMOTE_TOKEN"
COMPONENT = re.compile(r"[a-z0-9][a-z0-9._-]{0,95}\Z")
SHA = re.compile(r"[0-9a-fA-F]{40}\Z")
TOKEN = re.compile(r"[!-~]{1,4096}\Z")
MAX_RESPONSE_BYTES = 64 * 1024


class ReceiptError(Exception):
    """A failed deployment gate, safe to show without credentials."""


class TemporaryReceiptError(ReceiptError):
    """A transport failure that may resolve before the deadline."""


class RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, newurl):
        return None


def receipt_url(base_url: str, project: str, sha: str) -> str:
    if not COMPONENT.fullmatch(project) or not SHA.fullmatch(sha):
        raise ReceiptError("project or commit SHA is invalid")
    try:
        parts = urlsplit(base_url)
        _ = parts.port
    except ValueError as exc:
        raise ReceiptError("receipt base URL is invalid") from exc
    if (
        parts.scheme != "https"
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or "?" in base_url
        or "#" in base_url
        or any(ord(char) < 33 for char in base_url)
    ):
        raise ReceiptError("receipt base URL must be an HTTPS URL without credentials")
    return (
        base_url.rstrip("/")
        + "/attestations/"
        + quote(project, safe="")
        + "/"
        + sha.lower()
    )


def load_token(env_name: str, token_file: Path | None) -> str:
    if token_file is not None:
        try:
            token = token_file.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError) as exc:
            raise ReceiptError("remote CI token file is unavailable") from exc
    else:
        token = os.environ.get(env_name, "")
    if not TOKEN.fullmatch(token):
        raise ReceiptError("remote CI token is missing or invalid")
    return token


def fetch_receipt(url: str, token: str, timeout_seconds: float) -> dict:
    """Fetch one response; URL is validated by receipt_url in the CLI path."""
    request = Request(
        url,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
        method="GET",
    )
    try:
        with build_opener(RejectRedirect()).open(request, timeout=timeout_seconds) as response:
            if response.status != 200:
                raise ReceiptError(f"receipt endpoint returned HTTP {response.status}")
            if response.headers.get_content_type() != "application/json":
                raise ReceiptError("receipt endpoint returned the wrong content type")
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        raise ReceiptError(f"receipt endpoint returned HTTP {exc.code}") from exc
    except URLError as exc:
        if isinstance(exc.reason, ssl.SSLError):
            raise ReceiptError("receipt endpoint TLS verification failed") from exc
        raise TemporaryReceiptError("receipt endpoint is temporarily unavailable") from exc
    except ssl.SSLError as exc:
        raise ReceiptError("receipt endpoint TLS verification failed") from exc
    except TimeoutError as exc:
        raise TemporaryReceiptError("receipt endpoint timed out") from exc
    except OSError as exc:
        raise TemporaryReceiptError("receipt endpoint is temporarily unavailable") from exc
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ReceiptError("receipt response is too large")
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError) as exc:
        raise ReceiptError("receipt response is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise ReceiptError("receipt response must be an object")
    return payload


def assess_receipt(payload: dict, project: str, sha: str) -> tuple[bool, list[str]]:
    if payload.get("project") != project or payload.get("sha") != sha.lower():
        raise ReceiptError("receipt identity does not match the deployment")
    verified = payload.get("verified")
    missing = payload.get("missing_suites")
    failing = payload.get("failing_suites")
    if (
        type(verified) is not bool
        or not isinstance(missing, list)
        or not isinstance(failing, list)
        or any(not isinstance(item, str) or not COMPONENT.fullmatch(item) for item in missing + failing)
        or (verified and (missing or failing))
        or len(set(missing)) != len(missing)
        or len(set(failing)) != len(failing)
        or set(missing) & set(failing)
    ):
        raise ReceiptError("receipt response has an invalid verification state")
    if failing:
        raise ReceiptError("pre-push test suites failed: " + ", ".join(failing))
    if not verified and not missing:
        raise ReceiptError("no verified pre-push test suites are configured")
    return verified, missing


def verify_receipt(
    project: str,
    sha: str,
    base_url: str,
    token: str,
    timeout_seconds: float,
    poll_interval_seconds: float,
) -> None:
    url = receipt_url(base_url, project, sha)
    if (
        not math.isfinite(timeout_seconds)
        or not 1 <= timeout_seconds <= 600
        or not math.isfinite(poll_interval_seconds)
        or not 0.2 <= poll_interval_seconds <= 30
    ):
        raise ReceiptError("timeout or poll interval is outside the allowed range")
    deadline = time.monotonic() + timeout_seconds
    last_reason = "receipt not yet available"
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ReceiptError("timed out waiting for test receipt: " + last_reason)
        try:
            payload = fetch_receipt(url, token, min(10.0, remaining))
            verified, missing = assess_receipt(payload, project, sha)
            if verified:
                return
            last_reason = "missing suites: " + ", ".join(missing)
        except TemporaryReceiptError as exc:
            last_reason = str(exc)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ReceiptError("timed out waiting for test receipt: " + last_reason)
        time.sleep(min(poll_interval_seconds, remaining))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    credential = parser.add_mutually_exclusive_group()
    credential.add_argument("--token-env", default=DEFAULT_TOKEN_ENV)
    credential.add_argument("--token-file", type=Path)
    parser.add_argument("--timeout-seconds", type=float, default=120)
    parser.add_argument("--poll-interval-seconds", type=float, default=5)
    args = parser.parse_args(argv)
    try:
        token = load_token(args.token_env, args.token_file)
        verify_receipt(
            args.project,
            args.sha,
            args.base_url,
            token,
            args.timeout_seconds,
            args.poll_interval_seconds,
        )
    except ReceiptError as exc:
        print("CI test receipt: " + str(exc), file=sys.stderr)
        return 1
    print(f"CI test receipt verified for {args.project} at {args.sha.lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
