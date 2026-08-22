#!/usr/bin/env python3
"""Turns a findings.json (see references/schema.md) into a self-contained
HTML audit report using assets/report_template.html.

Usage:
    render_report.py --findings findings.json --out report.html [--title "Codebase Audit: fam"]
"""
import argparse
import json
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = SKILL_ROOT / "assets" / "report_template.html"

VALID_SEVERITIES = {"critical", "high", "medium", "low"}
VALID_SCORES = {"green", "yellow", "red"}


def validate(data: dict) -> list[str]:
    errors = []
    aspects = data.get("aspects", [])
    aspect_ids = {a.get("id") for a in aspects}

    for i, a in enumerate(aspects):
        if not a.get("id"):
            errors.append(f"aspects[{i}] missing 'id'")
        if a.get("score") not in VALID_SCORES:
            errors.append(f"aspects[{i}] ({a.get('id')}) has invalid score: {a.get('score')!r}")

    for i, f in enumerate(data.get("findings", [])):
        if f.get("aspect") not in aspect_ids:
            errors.append(f"findings[{i}] references unknown aspect {f.get('aspect')!r}")
        if f.get("severity") not in VALID_SEVERITIES:
            errors.append(f"findings[{i}] has invalid severity: {f.get('severity')!r}")
        if not f.get("file") or not f.get("title"):
            errors.append(f"findings[{i}] missing 'file' or 'title'")
        if f.get("aspect") == "best-practices" and not f.get("principle"):
            errors.append(f"findings[{i}] is aspect=best-practices but missing 'principle' tag")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--findings", required=True, type=Path, help="path to findings.json")
    parser.add_argument("--out", required=True, type=Path, help="path to write the HTML report")
    parser.add_argument("--title", default=None, help="report title (default derived from meta.scope)")
    args = parser.parse_args()

    data = json.loads(args.findings.read_text())

    errors = validate(data)
    if errors:
        print("findings.json failed validation:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    title = args.title or f"Codebase Audit: {data.get('meta', {}).get('scope', 'report')}"
    template = TEMPLATE_PATH.read_text()
    html = template.replace("__TITLE__", title).replace(
        "__REPORT_JSON__", json.dumps(data, ensure_ascii=False)
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html)
    print(f"Wrote {args.out} ({len(data.get('findings', []))} findings across {len(data.get('aspects', []))} aspects)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
