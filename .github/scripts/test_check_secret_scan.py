import contextlib
import copy
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "check_secret_scan", Path(__file__).with_name("check-secret-scan.py")
)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def public_commit_finding():
    return {
        "DetectorName": "CloudflareApiToken",
        "Verified": False,
        "Raw": "c1c8a8c1471069fb0e18" + "8eeaff69b8e8db6564a8",
        "SourceMetadata": {"Data": {"Git": {
            "file": "skills/README.md",
            "commit": "bb538ceded7bb7e884fec" + "33e27918aa306fc83b9",
            "line": 5,
        }}},
    }


class PublicCommitExceptionTests(unittest.TestCase):
    def test_accepts_exact_public_revision(self):
        self.assertTrue(policy.is_public_upstream_commit(public_commit_finding()))

    def test_other_values_and_verified_findings_remain_blocked(self):
        for key, value in (
            ("DetectorName", "OtherDetector"),
            ("Verified", True),
            ("Verified", None),
            ("Raw", "different-value"),
        ):
            with self.subTest(key=key, value=value):
                finding = public_commit_finding()
                finding[key] = value
                self.assertFalse(policy.is_public_upstream_commit(finding))

    def test_other_files_commits_and_lines_remain_blocked(self):
        for key, value in (
            ("file", "web/lib/config.ts"),
            ("commit", "another-commit"),
            ("line", 6),
        ):
            with self.subTest(key=key):
                finding = public_commit_finding()
                finding["SourceMetadata"]["Data"]["Git"][key] = value
                self.assertFalse(policy.is_public_upstream_commit(finding))

    def test_missing_metadata_is_not_an_exception(self):
        finding = public_commit_finding()
        finding.pop("SourceMetadata")
        self.assertFalse(policy.is_public_upstream_commit(finding))

    def test_original_dummy_url_exception_stays_exact(self):
        finding = {
            "DetectorName": "URI", "Verified": False,
            "Raw": "https://" + "user" + ":" + "secret" + "@" + "example.com",
            "SourceMetadata": {"Data": {"Git": {
                "file": "web/tests/unit/lib/utils/interview-calendar.test.ts",
                "commit": "061d80978df4b82f575d" + "1b644342205293a560eb",
                "line": 34,
            }}},
        }
        self.assertTrue(policy.is_historical_fixture(finding))
        changed = copy.deepcopy(finding)
        changed["SourceMetadata"]["Data"]["Git"]["line"] = 35
        self.assertFalse(policy.is_historical_fixture(changed))


class ScanExitPolicyTests(unittest.TestCase):
    def run_policy(self, findings, status):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "scan.jsonl"
            report.write_text("\n".join(json.dumps(f) for f in findings), encoding="utf-8")
            output = io.StringIO()
            with patch.object(sys, "argv", ["check-secret-scan.py", str(report), str(status)]):
                with contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as result:
                    policy.main()
            return result.exception.code, output.getvalue()

    def test_clean_scan_passes(self):
        self.assertEqual(self.run_policy([], 0)[0], 0)

    def test_only_exact_known_finding_passes(self):
        self.assertEqual(self.run_policy([public_commit_finding()], 183)[0], 0)

    def test_other_secret_blocks_and_is_not_logged(self):
        finding = public_commit_finding()
        finding["Raw"] = "unrelated-dummy-value"
        code, output = self.run_policy([public_commit_finding(), finding], 183)
        self.assertEqual(code, 1)
        self.assertNotIn(finding["Raw"], output)
        self.assertIn("1 blocked", output)

    def test_scanner_failure_is_not_ignored(self):
        self.assertEqual(
            self.run_policy([public_commit_finding()], 2)[0],
            "Secret scanner failed with exit code 2.",
        )

    def test_findings_exit_without_results_is_not_ignored(self):
        self.assertEqual(
            self.run_policy([], 183)[0],
            "Scanner reported findings but produced no JSON results.",
        )


if __name__ == "__main__":
    unittest.main()
