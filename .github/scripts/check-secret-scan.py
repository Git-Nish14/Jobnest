"""Fail on every finding except one exact, historical dummy URL test fixture."""

import json
import sys
from pathlib import Path


def is_historical_fixture(finding):
    git = finding.get("SourceMetadata", {}).get("Data", {}).get("Git", {})
    # This exception cannot suppress a different credential, file, or commit.
    dummy_url = "https://" + "user" + ":" + "secret" + "@" + "example.com"
    return (
        finding.get("DetectorName") == "URI"
        and finding.get("Verified") is False
        and finding.get("Raw") == dummy_url
        and git.get("file") == "web/tests/unit/lib/utils/interview-calendar.test.ts"
        and git.get("commit") == "061d80978df4b82f575d1b644342205293a560eb"
        and git.get("line") == 34
    )


def main():
    report = Path(sys.argv[1])
    status = int(sys.argv[2])
    if status not in (0, 183):
        raise SystemExit(f"Secret scanner failed with exit code {status}.")
    findings = [json.loads(line) for line in report.read_text(encoding="utf-8").splitlines() if line.strip()]
    if status == 183 and not findings:
        raise SystemExit("Scanner reported findings but produced no JSON results.")
    blocked = [finding for finding in findings if not is_historical_fixture(finding)]
    for finding in blocked:
        git = finding.get("SourceMetadata", {}).get("Data", {}).get("Git", {})
        # Never print Raw/Redacted values; CI logs must not disclose credentials.
        print(f"Secret finding: {finding.get('DetectorName', 'unknown')} in {git.get('file', 'unknown')}:{git.get('line', '?')}")
    print(f"Secret scan: {len(blocked)} blocked; {len(findings) - len(blocked)} known historical test fixture(s).")
    raise SystemExit(1 if blocked else 0)


if __name__ == "__main__":
    main()
