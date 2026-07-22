"""Verify the frozen LibreOffice Calc 24.2 A01 export without project imports."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPORT = Path(__file__).with_name("p2-truss-libreoffice-a01.csv")
OUTPUT = ROOT / "qa-results" / "p2-truss-libreoffice" / "result.json"

E = 200e9
A = 0.001
P = 100_000.0

ANALYTIC = {
    "R1x": 0.0,
    "R1y": P / 2,
    "R2y": P / 2,
    "N13": -P * math.sqrt(13) / 6,
    "N23": -P * math.sqrt(13) / 6,
    "N12": P / 3,
    "u2x": (P / 3) * 4 / (E * A),
    "u3x": (P / 3) * 2 / (E * A),
    "u3y": -P * (13 * math.sqrt(13) / 18 + 4 / 9) / (E * A),
}


def main() -> None:
    with EXPORT.open(encoding="utf-8", newline="") as source:
        exported = {row["quantity"]: float(row["libreoffice_value"]) for row in csv.DictReader(source)}

    rows = []
    passed = True
    for quantity, expected in ANALYTIC.items():
        actual = exported[quantity]
        absolute = abs(actual - expected)
        relative = absolute / abs(expected) if expected else 0.0
        tolerance = 1e-8 if expected else 1e-6
        row_passed = relative <= tolerance if expected else absolute <= tolerance
        passed = passed and row_passed
        rows.append({
            "quantity": quantity,
            "analytic": expected,
            "libreofficeCalc24_2": actual,
            "absoluteDifference": absolute,
            "relativeDifference": relative,
            "passed": row_passed,
        })

    result = {
        "case": "P2-TRUSS-X01",
        "externalTool": "LibreOffice Calc 24.2",
        "comparison": "joint method and virtual-work closed form versus frozen Calc DSM export",
        "projectCodeImported": False,
        "passed": passed,
        "rows": rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
