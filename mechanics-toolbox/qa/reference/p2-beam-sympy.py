"""Independent P2 CBEAM-A03/A05 symbolic check. Never imports project solver output."""

from __future__ import annotations

import json
from pathlib import Path

import sympy as sp


EXPECTED_SYMPY = "1.14.0"
if sp.__version__ != EXPECTED_SYMPY:
    raise RuntimeError(f"SymPy version must be {EXPECTED_SYMPY}, got {sp.__version__}")

x = sp.symbols("x", real=True)
L = sp.Rational(4)
w = sp.Rational(10_000)  # downward load magnitude; project q_y=-w
E = sp.Rational(200_000_000_000)


def relative_error(actual: sp.Expr, expected: sp.Expr) -> float:
    if expected == 0:
        return float(abs(sp.N(actual)))
    return float(abs(sp.N((actual - expected) / expected)))


def a03() -> dict[str, object]:
    inertia = sp.Rational(8, 1_000_000)
    rb = sp.symbols("R_B", real=True)
    compatibility = sp.Eq(-w * L**4 / (8 * E * inertia) + rb * L**3 / (3 * E * inertia), 0)
    rb_value = sp.solve(compatibility, rb)[0]
    ra_value = w * L - rb_value
    moment = -w * (L - x) ** 2 / 2 + rb_value * (L - x)
    theta_right = -w * L**3 / (6 * E * inertia) + rb_value * L**2 / (2 * E * inertia)
    expected = {
        "RA_N": sp.Rational(25_000),
        "RB_N": sp.Rational(15_000),
        "M_left_Nm": sp.Rational(-20_000),
        "theta_right_rad": sp.Rational(1, 120),
    }
    actual = {
        "RA_N": ra_value,
        "RB_N": rb_value,
        "M_left_Nm": sp.simplify(moment.subs(x, 0)),
        "theta_right_rad": sp.simplify(theta_right),
    }
    return {
        "compatibility": str(compatibility),
        "moment_Nm": str(sp.expand(moment)),
        "actual": {key: float(sp.N(value, 17)) for key, value in actual.items()},
        "exact": {key: str(value) for key, value in actual.items()},
        "relativeErrors": {key: relative_error(actual[key], expected[key]) for key in expected},
    }


def a05() -> dict[str, object]:
    inertia = sp.Rational(8, 100_000)
    c0, c1 = sp.symbols("C_0 C_1", real=True)
    moment = c0 + c1 * x - w * x**2 / 2
    theta = sp.integrate(moment / (E * inertia), x)
    displacement = sp.integrate(theta, x)
    solution = sp.solve(
        [sp.Eq(theta.subs(x, L), 0), sp.Eq(displacement.subs(x, L), 0)],
        [c0, c1],
        dict=True,
    )[0]
    moment = sp.expand(moment.subs(solution))
    roots = sorted(sp.solve(sp.Eq(moment, 0), x), key=lambda root: float(sp.N(root)))
    actual = {
        "RA_N": solution[c1],
        "RB_N": w * L - solution[c1],
        "M_left_Nm": moment.subs(x, 0),
        "M_right_Nm": moment.subs(x, L),
        "M_mid_Nm": moment.subs(x, L / 2),
        "inflection_left_m": roots[0],
        "inflection_right_m": roots[1],
    }
    expected = {
        "RA_N": sp.Rational(20_000),
        "RB_N": sp.Rational(20_000),
        "M_left_Nm": sp.Rational(-40_000, 3),
        "M_right_Nm": sp.Rational(-40_000, 3),
        "M_mid_Nm": sp.Rational(20_000, 3),
        "inflection_left_m": 2 - 2 * sp.sqrt(3) / 3,
        "inflection_right_m": 2 + 2 * sp.sqrt(3) / 3,
    }
    return {
        "boundaryEquations": [str(sp.Eq(theta.subs(x, L), 0)), str(sp.Eq(displacement.subs(x, L), 0))],
        "moment_Nm": str(moment),
        "actual": {key: float(sp.N(value, 17)) for key, value in actual.items()},
        "exact": {key: str(value) for key, value in actual.items()},
        "relativeErrors": {key: relative_error(actual[key], expected[key]) for key in expected},
    }


cases = {"P2-CBEAM-A03": a03(), "P2-CBEAM-A05": a05()}
all_errors = [error for case in cases.values() for error in case["relativeErrors"].values()]
result = {
    "schemaVersion": "1.0.0",
    "tool": f"SymPy {sp.__version__}",
    "units": "SI",
    "source": "independent force-method and EB compatibility equations",
    "importsProjectSolver": False,
    "tolerance": {"relative": 1e-9, "positionAbsolute_m": 1e-9},
    "cases": cases,
    "passed": max(all_errors, default=0.0) <= 1e-9,
}

output_dir = Path(__file__).resolve().parents[2] / "qa-results" / "p2-beam-sympy"
output_dir.mkdir(parents=True, exist_ok=True)
output_path = output_dir / "result.json"
output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"output": str(output_path), "passed": result["passed"], "tool": result["tool"]}, ensure_ascii=False))
if not result["passed"]:
    raise SystemExit(1)
