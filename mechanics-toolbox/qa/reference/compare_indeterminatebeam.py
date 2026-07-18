"""Compare public P1 bending-moment benchmarks with pinned IndeterminateBeam clone."""

from __future__ import annotations

import json
import sys
from pathlib import Path


TOOLBOX_ROOT = Path(__file__).resolve().parents[2]
MECHANICS_ROOT = TOOLBOX_ROOT.parent
REFERENCE_ROOT = MECHANICS_ROOT / "referance" / "IndeterminateBeam"
FIXTURE_PATH = TOOLBOX_ROOT / "qa" / "fixtures" / "beam-public-moment-benchmarks.json"
OUTPUT_PATH = TOOLBOX_ROOT / "qa-results" / "indeterminatebeam-moment-comparison.json"


def rounded(value: float, decimals: int) -> str:
    zero_threshold = 0.5 * 10 ** -decimals
    normalized = 0.0 if abs(value) < zero_threshold else value
    return f"{normalized:.{decimals}f}"


def query_position(x_m: float, side: str, length_m: float) -> float:
    # IndeterminateBeam itself samples x ± 1e-7 m. Step farther than that so
    # an explicit left/right query does not straddle a point-moment jump.
    epsilon = 2e-7
    if 0 < x_m < length_m:
        return x_m - epsilon if side == "left" else x_m + epsilon
    return x_m


def main() -> int:
    if not (REFERENCE_ROOT / "indeterminatebeam").is_dir():
        raise FileNotFoundError(f"IndeterminateBeam clone not found: {REFERENCE_ROOT}")
    sys.path.insert(0, str(REFERENCE_ROOT))

    from indeterminatebeam import Beam, PointLoadV, PointTorque, Support, UDLV

    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    decimals = int(fixture["comparison"]["publishedDisplayDecimals"])
    rows: list[dict[str, object]] = []

    for case in fixture["cases"]:
        beam = Beam(case["lengthM"], E=200e9, I=8e-6)
        support = case["support"]
        if support == "simplySupported":
            beam.add_supports(Support(0, (1, 1, 0)), Support(case["lengthM"], (0, 1, 0)))
        elif support == "cantileverLeft":
            beam.add_supports(Support(0, (1, 1, 1)))
        elif support == "cantileverRight":
            beam.add_supports(Support(case["lengthM"], (1, 1, 1)))
        else:
            raise ValueError(f"Unsupported support: {support}")

        loads = []
        for load in case["loads"]:
            if load["type"] == "pointForce":
                loads.append(PointLoadV(load["forceN"], load["positionM"]))
            elif load["type"] == "pointMoment":
                loads.append(PointTorque(load["momentNm"], load["positionM"]))
            elif load["type"] == "uniformLoad":
                loads.append(UDLV(load["intensityNPerM"], (load["startM"], load["endM"])))
            else:
                raise ValueError(f"Unsupported load: {load['type']}")

        beam.add_loads(*loads)
        beam.analyse()
        probe_rows = []
        case_passed = True
        for probe in case["probes"]:
            query_x = query_position(probe["xM"], probe["side"], case["lengthM"])
            actual = float(beam.get_bending_moment(query_x))
            expected_text = rounded(float(probe["expectedMomentNm"]), decimals)
            actual_text = rounded(actual, decimals)
            passed = actual_text == expected_text
            case_passed = case_passed and passed
            probe_rows.append(
                {
                    "xM": probe["xM"],
                    "side": probe["side"],
                    "expectedNm": probe["expectedMomentNm"],
                    "referenceNm": actual,
                    "expectedPublished": expected_text,
                    "referencePublished": actual_text,
                    "passed": passed,
                }
            )

        rows.append({"id": case["id"], "title": case["title"], "passed": case_passed, "probes": probe_rows})

    output = {
        "reference": {
            "repository": "https://github.com/JesseBonanno/IndeterminateBeam",
            "commit": "4d504df",
            "path": str(REFERENCE_ROOT),
        },
        "publicFormulaSource": fixture["source"],
        "comparison": fixture["comparison"],
        "passedCases": sum(1 for row in rows if row["passed"]),
        "totalCases": len(rows),
        "passed": all(bool(row["passed"]) for row in rows),
        "cases": rows,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"IndeterminateBeam public moment comparison: {output['passedCases']}/{output['totalCases']}")
    print(OUTPUT_PATH)
    return 0 if output["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
