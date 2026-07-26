import katex from 'katex'
import { describe, expect, it } from 'vitest'
import type { SectionCalculatorKind } from '../../../src/core/sections'
import { SECTION_FORMULA_CATALOG } from '../../../src/features/sections/sectionFormulaCatalog'

const expectedKinds: readonly SectionCalculatorKind[] = [
  'rectangle',
  'hollowRectangle',
  'solidCircle',
  'circularTube',
  'regularHexagon',
  'regularOctagon',
  'semicircle',
  'semiAnnulus',
  'circularSector',
  'circularSegment',
  'annularSector',
  'ellipse',
  'hollowEllipse',
  'squareCircularHole',
  'circleCrossSlot',
  'rectangleCrossSlot',
]

describe('section formula catalog', () => {
  it('covers every workbench section and every formula is valid KaTeX', () => {
    expect(Object.keys(SECTION_FORMULA_CATALOG).sort()).toEqual([...expectedKinds].sort())

    for (const kind of expectedKinds) {
      const content = SECTION_FORMULA_CATALOG[kind]
      expect(content.title).not.toBe('')
      expect(content.formulas.length).toBeGreaterThan(0)
      for (const formula of content.formulas) {
        expect(() => katex.renderToString(formula.latex, { throwOnError: true })).not.toThrow()
      }
    }
  })
})
