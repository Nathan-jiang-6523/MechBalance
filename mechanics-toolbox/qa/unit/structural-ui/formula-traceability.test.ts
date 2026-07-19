import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { runStructuralCalculation } from '../../../src/features/structural/calculation'
import { STRUCTURAL_THEORY_CATALOG } from '../../../src/features/structural/catalog'
import { getStructuralExample } from '../../../src/features/structural/examples'

const formulasDirectory = path.resolve(process.cwd(), 'docs', 'formulas')

function readFormulaDocument(name: string): string {
  return fs.readFileSync(path.join(formulasDirectory, name), 'utf8')
}

describe('P2 formula document traceability', () => {
  it('keeps truss and frame documents self-contained and linked to the current index', () => {
    const documents = [
      {
        name: 'p2-truss.md',
        documentVersion: 'P2-TRUSS-FORMULAS-v1.0.0',
        fixture: 'qa/fixtures/p2-truss.json',
        formulas: [
          ['P2-TRUSS-001', 'P2-TRUSS-v1'],
          ['P2-TRUSS-INITIAL-001', 'P2-TRUSS-INITIAL-v1'],
        ],
      },
      {
        name: 'p2-frame.md',
        documentVersion: 'P2-FRAME-FORMULAS-v1.0.0',
        fixture: 'qa/fixtures/p2-frame.json',
        formulas: [
          ['P2-FRAME-001', 'P2-FRAME-v1'],
          ['P2-FRAME-INITIAL-001', 'P2-FRAME-INITIAL-v1'],
        ],
      },
    ] as const

    for (const document of documents) {
      const text = readFormulaDocument(document.name)
      expect(text).toContain(`文档版本：\`${document.documentVersion}\``)
      expect(text).toContain('索引版本 `P2-FORMULA-INDEX-v1.3.0`')
      expect(text).toContain(document.fixture)
      expect(text).toContain('schema `1.0.0`')
      expect(text).toContain('访问 `2026-07-19`')
      expect(text).toContain('禁止项目输出回填')
      for (const [id, version] of document.formulas) {
        expect(text).toContain(`\`${id}\``)
        expect(text).toContain(`\`${version}\``)
      }
    }
  })

  it('keeps every displayed formula ID/version registered in the canonical index', () => {
    const index = readFormulaDocument('p2-index.md')
    const registered = [
      ['P2-EB-001', 'P2-EB6-v1'],
      ['P2-EB-002', 'P2-EB-LOAD-v1'],
      ['P2-DSM-001', 'P2-DSM-v1'],
      ['P2-EB-RECOVERY-001', 'P2-EB-RECOVERY-v1'],
      ['P2-CBEAM-001', 'P2-CBEAM-v1'],
      ['P2-TRUSS-001', 'P2-TRUSS-v1'],
      ['P2-TRUSS-INITIAL-001', 'P2-TRUSS-INITIAL-v1'],
      ['P2-FRAME-001', 'P2-FRAME-v1'],
      ['P2-FRAME-INITIAL-001', 'P2-FRAME-INITIAL-v1'],
      ['P2-IL-001', 'P2-IL-v1'],
      ['P2-ML-001', 'P2-ML-v1'],
    ] as const

    for (const [id, version] of registered) {
      expect(index).toContain(`| \`${id}\` | \`${version}\``)
    }
  })

  it('does not leave beam documents pinned to the retired v1.0.0 index', () => {
    for (const name of ['p2-beam-element.md', 'p2-beam-mesh-validation.md']) {
      const text = readFormulaDocument(name)
      expect(text).toContain('P2-FORMULA-INDEX-v1.3.0')
      expect(text).not.toContain('P2-FORMULA-INDEX-v1.0.0')
    }
  })

  it('keeps each result metadata formula set complete against its displayed module theory', () => {
    const examples = ['BEAM-A01', 'TRUSS-A01', 'FRAME-A01', 'IL-A03', 'ML-A01'] as const
    const modules = ['beam', 'truss', 'frame', 'influence-line', 'moving-load'] as const
    for (let index = 0; index < examples.length; index += 1) {
      const result = runStructuralCalculation(getStructuralExample(examples[index]!))
      const metadata = result.metadata.formulaReferences.map(({ id, version }) => `${id}@${version}`).sort()
      const theory = STRUCTURAL_THEORY_CATALOG[modules[index]]!.formulas
        .map(({ id, version }) => `${id}@${version}`).sort()
      expect(metadata, examples[index]).toEqual(theory)
    }
  })
})
