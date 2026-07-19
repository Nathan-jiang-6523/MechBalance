"""Recompute FRAME-X01 by independent DSM and verify frozen Calc 24.2 export.

No project modules or third-party numerical packages are imported.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPORT = Path(__file__).with_name("p2-frame-libreoffice-a01.csv")
OUTPUT = ROOT / "qa-results" / "p2-frame-libreoffice" / "result.json"

E = 200e9
A = 0.01
I = 8e-5
NODES = ((0.0, 0.0), (0.0, 3.0), (4.0, 3.0), (4.0, 0.0))
ELEMENTS = ((0, 1, "12"), (1, 2, "23"), (3, 2, "43"))


def zeros(rows: int, columns: int) -> list[list[float]]:
    return [[0.0 for _ in range(columns)] for _ in range(rows)]


def transpose(matrix: list[list[float]]) -> list[list[float]]:
    return [list(column) for column in zip(*matrix)]


def multiply(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    return [[sum(a * b for a, b in zip(row, column)) for column in zip(*right)] for row in left]


def multiply_vector(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(value * vector[index] for index, value in enumerate(row)) for row in matrix]


def solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    augmented = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    size = len(augmented)
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) <= 1e-14:
            raise ArithmeticError("independent DSM reduced stiffness is singular")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        scale = augmented[column][column]
        augmented[column] = [value / scale for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(augmented[row], augmented[column])
            ]
    return [row[-1] for row in augmented]


def frame_element(node_i: tuple[float, float], node_j: tuple[float, float]):
    dx = node_j[0] - node_i[0]
    dy = node_j[1] - node_i[1]
    length = math.hypot(dx, dy)
    c = dx / length
    s = dy / length
    axial = E * A / length
    bend_12 = 12 * E * I / length**3
    bend_6 = 6 * E * I / length**2
    bend_4 = 4 * E * I / length
    bend_2 = 2 * E * I / length
    local = [
        [axial, 0, 0, -axial, 0, 0],
        [0, bend_12, bend_6, 0, -bend_12, bend_6],
        [0, bend_6, bend_4, 0, -bend_6, bend_2],
        [-axial, 0, 0, axial, 0, 0],
        [0, -bend_12, -bend_6, 0, bend_12, -bend_6],
        [0, bend_6, bend_2, 0, -bend_6, bend_4],
    ]
    transform = [
        [c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1],
    ]
    global_stiffness = multiply(multiply(transpose(transform), local), transform)
    return local, transform, global_stiffness


def independent_dsm() -> dict[str, float]:
    stiffness = zeros(12, 12)
    element_data = {}
    for node_i, node_j, element_id in ELEMENTS:
        local, transform, global_stiffness = frame_element(NODES[node_i], NODES[node_j])
        dofs = (3 * node_i, 3 * node_i + 1, 3 * node_i + 2, 3 * node_j, 3 * node_j + 1, 3 * node_j + 2)
        for local_row, global_row in enumerate(dofs):
            for local_column, global_column in enumerate(dofs):
                stiffness[global_row][global_column] += global_stiffness[local_row][local_column]
        element_data[element_id] = (local, transform, dofs)

    loads = [0.0] * 12
    loads[3] = 6000.0
    loads[6] = 6000.0
    free = (3, 4, 5, 6, 7, 8)
    reduced = [[stiffness[row][column] for column in free] for row in free]
    reduced_load = [loads[dof] for dof in free]
    free_displacements = solve(reduced, reduced_load)
    displacements = [0.0] * 12
    for dof, value in zip(free, free_displacements):
        displacements[dof] = value
    reactions = [value - loads[index] for index, value in enumerate(multiply_vector(stiffness, displacements))]

    end_forces = {}
    for element_id, (local, transform, dofs) in element_data.items():
        local_displacements = multiply_vector(transform, [displacements[dof] for dof in dofs])
        end_forces[element_id] = multiply_vector(local, local_displacements)

    return {
        "u2x": displacements[3], "u2y": displacements[4], "theta2": displacements[5],
        "u3x": displacements[6], "u3y": displacements[7], "theta3": displacements[8],
        "R1x": reactions[0], "R1y": reactions[1], "R1m": reactions[2],
        "R4x": reactions[9], "R4y": reactions[10], "R4m": reactions[11],
        "M12j": end_forces["12"][5], "M43j": end_forces["43"][5],
        "V23i": end_forces["23"][1], "M23i": end_forces["23"][2],
        "V23j": end_forces["23"][4], "M23j": end_forces["23"][5],
    }


def main() -> None:
    with EXPORT.open(encoding="utf-8", newline="") as source:
        exported = {row["quantity"]: float(row["libreoffice_value"]) for row in csv.DictReader(source)}
    expected = independent_dsm()
    rows = []
    passed = True
    for quantity, analytic in expected.items():
        actual = exported[quantity]
        absolute = abs(actual - analytic)
        relative = absolute / abs(analytic) if analytic else 0.0
        row_passed = relative <= 2e-5 if analytic else absolute <= 1e-6
        passed = passed and row_passed
        rows.append({
            "quantity": quantity,
            "independentDsm": analytic,
            "libreofficeCalc24_2": actual,
            "absoluteDifference": absolute,
            "relativeDifference": relative,
            "passed": row_passed,
        })
    result = {
        "case": "P2-FRAME-X01",
        "externalTool": "LibreOffice Calc 24.2",
        "comparison": "independent standard-library DSM versus frozen Calc DSM export",
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
