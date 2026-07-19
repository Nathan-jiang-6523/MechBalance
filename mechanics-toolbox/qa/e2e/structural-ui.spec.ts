import { expect, test, type Locator, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href
const runtimeErrors = new WeakMap<Page, string[]>()

interface ExpectedTableValue {
  readonly label: string
  readonly objectId: string
  readonly expected: number
  readonly relativeTolerance: number
  readonly absoluteTolerance?: number
}

function parseDisplayedNumber(text: string): number {
  return Number.parseFloat(text.trim().replace('\u2212', '-'))
}

async function expectTableValues(table: Locator, expectedValues: readonly ExpectedTableValue[]): Promise<void> {
  await expect(table).toBeVisible()
  await expect(table.locator('tbody tr').first()).toBeVisible()
  const rows = await table.locator('tbody tr').evaluateAll((elements) => elements.map((element) =>
    [...element.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? '')))

  for (const expected of expectedValues) {
    const cells = rows.find((row) => row[0] === expected.label && row[1] === expected.objectId)
    expect(cells, `${expected.label} / ${expected.objectId} row`).toBeDefined()
    const actual = parseDisplayedNumber(cells![2]!)
    const tolerance = Math.max(
      expected.absoluteTolerance ?? 0,
      Math.abs(expected.expected) * expected.relativeTolerance,
    )
    expect(Math.abs(actual - expected.expected), `${expected.label} / ${expected.objectId}`).toBeLessThanOrEqual(tolerance)
  }
}

async function expectNoInvalidNumericText(page: Page): Promise<void> {
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/\b(?:NaN|Infinity)\b/)
  expect(text).not.toMatch(/(?:^|[\s(])-0(?:\.0+)?(?=$|[\s,;）)\]])/m)
}

async function expectLastColumnReadable(table: Locator): Promise<void> {
  const wrapper = table.locator('xpath=..')
  await wrapper.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  const geometry = await table.locator('tbody tr').first().locator('td').last().evaluate((cell) => {
    const cellRect = cell.getBoundingClientRect()
    const wrapperRect = cell.parentElement!.parentElement!.parentElement!.parentElement!.getBoundingClientRect()
    return {
      cellLeft: cellRect.left,
      cellRight: cellRect.right,
      wrapperLeft: wrapperRect.left,
      wrapperRight: wrapperRect.right,
    }
  })
  expect(geometry.cellLeft).toBeGreaterThanOrEqual(geometry.wrapperLeft - 1)
  expect(geometry.cellRight).toBeLessThanOrEqual(geometry.wrapperRight + 1)
}

async function expectNoDiagramLabelCollisions(page: Page): Promise<void> {
  const collisions = await page.locator('.structure-diagram').evaluate((diagram) => {
    const labels = [...diagram.querySelectorAll<SVGGraphicsElement>('.node-label, .element-label, .local-axes text')]
    const obstacles = [...diagram.querySelectorAll<SVGGraphicsElement>('.support, .load-arrow, .nodal-moment')]
    const overlapArea = (left: DOMRect, right: DOMRect) =>
      Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
      * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
    const found: string[] = []
    for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
      const label = labels[leftIndex]!
      for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
        const other = labels[rightIndex]!
        if (overlapArea(label.getBoundingClientRect(), other.getBoundingClientRect()) > 0) {
          found.push(`${label.textContent}/${other.textContent}`)
        }
      }
      for (const obstacle of obstacles) {
        if (overlapArea(label.getBoundingClientRect(), obstacle.getBoundingClientRect()) > 0) {
          found.push(`${label.textContent}/${obstacle.getAttribute('class')}`)
        }
      }
    }
    return found
  })
  expect(collisions, 'P2_UI_LABEL_COLLISION').toEqual([])
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) errors.push(`external request: ${request.url()}`)
  })
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /结构力学/ }).click()
  await expect(page.getByRole('heading', { name: '结构分析工作台' })).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([])
})

test('BEAM-A01 首次计算、单位原子切换和旧结果失效', async ({ page }) => {
  const unitPreset = page.getByTestId('structural-unit-preset')
  const engineeringPreset = unitPreset.getByRole('button', { name: 't–mm–MPa–N–s' })
  const siPreset = unitPreset.getByRole('button', { name: 'SI（kg–m–Pa–N–s）' })
  await expect(engineeringPreset).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('等待首次计算')).toBeVisible()

  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await page.locator('[data-detail="displacements"] summary').click()
  await expect(page.getByTestId('displacement-table')).toContainText('mm')
  await expect(page.getByTestId('control-table')).toContainText('N·mm')

  await siPreset.click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await expect(page.getByTestId('displacement-table')).toContainText('m')
  await engineeringPreset.click()
  await expect(page.getByTestId('displacement-table')).toContainText('mm')

  const firstNodeX = page.locator('.structural-model-editor [data-field="nodes[0].x"]')
  await firstNodeX.fill('')
  await expect(page.getByRole('heading', { name: '计算完成' })).toHaveCount(0)
  await expect(page.getByText('旧结果已清除')).toBeVisible()
})

test('桁架、刚架、影响线和移动荷载均可从冻结算例计算', async ({ page }) => {
  for (const item of [
    { module: 'truss', detail: 'elements', resultText: '杆件正应力' },
    { module: 'frame', detail: 'reactions', resultText: '支座反力矩' },
    { module: 'influence-line', detail: undefined, resultText: 'left（左侧）' },
    { module: 'moving-load', detail: undefined, resultText: '控制轴' },
  ]) {
    await page.locator(`[data-module-id="${item.module}"]`).click()
    await page.getByRole('button', { name: '计算结构响应' }).click()
    await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
    if (item.detail) await page.locator(`[data-detail="${item.detail}"] summary`).click()
    await expect(page.locator('.structural-results')).toContainText(item.resultText)
  }
})

test('结构工作台在当前视口内且关键触控目标不小于 44px', async ({ page }) => {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const sizes = await page.locator('.calculator-toolbar select, .unit-preset-control button, .calculate-button').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44)
    expect(size.height).toBeGreaterThanOrEqual(44)
  }
})

test('桌面 FRAME-A01 与编辑器构造 CBEAM-A03 符合冻结真值及图层契约', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', '冻结 UI-01 只在 1440×900 桌面视口执行')
  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 })

  await page.locator('[data-module-id="frame"]').click()
  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await page.locator('[data-detail="displacements"] summary').click()
  await page.locator('[data-detail="reactions"] summary').click()

  await expectTableValues(page.getByTestId('displacement-table'), [
    { label: '节点位移 u', objectId: '2', expected: 1.30736068252, relativeTolerance: 1e-7 },
    { label: '节点位移 v', objectId: '2', expected: 0.00551370484661, relativeTolerance: 1e-7 },
    { label: '节点转角 θ', objectId: '2', expected: -0.000309073788346, relativeTolerance: 1e-7 },
    { label: '节点位移 u', objectId: '3', expected: 1.30736068252, relativeTolerance: 1e-7 },
    { label: '节点位移 v', objectId: '3', expected: -0.00551370484661, relativeTolerance: 1e-7 },
  ])
  await expectTableValues(page.getByTestId('reaction-table'), [
    { label: '支座反力 Fx', objectId: '1', expected: -6_000, relativeTolerance: 1e-7 },
    { label: '支座反力 Fy', objectId: '1', expected: -3_675.80323108, relativeTolerance: 1e-7 },
    { label: '支座反力矩 Mz', objectId: '1', expected: 10_648_393.5378, relativeTolerance: 1e-7 },
    { label: '支座反力 Fx', objectId: '4', expected: -6_000, relativeTolerance: 1e-7 },
    { label: '支座反力 Fy', objectId: '4', expected: 3_675.80323108, relativeTolerance: 1e-7 },
    { label: '支座反力矩 Mz', objectId: '4', expected: 10_648_393.5378, relativeTolerance: 1e-7 },
  ])

  const diagram = page.locator('.structure-diagram')
  await expect(diagram.locator('.global-axes')).toBeVisible()
  await expect(diagram.locator('.element-line')).toHaveCount(3)
  await expect(diagram.locator('.local-axes')).toHaveCount(3)
  await expect(diagram.locator('.node')).toHaveCount(4)
  await expect(diagram.locator('.support')).toHaveCount(2)
  await expect(diagram.locator('.load-arrow')).toHaveCount(2)
  await expect(diagram.locator('.deformed-element')).toHaveCount(3)
  await expect(diagram.locator('.load-arrow[data-load-id="H2"]')).toHaveAttribute('data-direction', 'global+x')
  await expect(diagram.locator('.load-arrow[data-load-id="H3"]')).toHaveAttribute('data-direction', 'global+x')
  await expectNoDiagramLabelCollisions(page)

  for (const layer of [
    { id: 'node-labels', selector: '.node-label', count: 4 },
    { id: 'element-labels', selector: '.element-label', count: 3 },
    { id: 'local-axes', selector: '.local-axes', count: 3 },
    { id: 'supports', selector: '.support', count: 2 },
    { id: 'loads', selector: '.load-arrow, .nodal-moment', count: 2 },
    { id: 'results', selector: '.deformed-element', count: 3 },
  ]) {
    const toggle = page.locator(`[data-layer-toggle="${layer.id}"]`)
    await toggle.uncheck()
    await expect(diagram.locator(layer.selector)).toHaveCount(0)
    if (layer.id === 'loads') await expect(diagram.locator('.legend-zone')).toHaveCount(0)
    await toggle.check()
    await expect(diagram.locator(layer.selector)).toHaveCount(layer.count)
  }

  await page.locator('[data-module-id="beam"]').click()
  await page.locator('[data-add="constraints"]').click()
  const addedConstraint = page.locator('.structural-model-editor [data-remove^="constraints"]').last().locator('xpath=..')
  await addedConstraint.locator('input').first().fill('1')
  await addedConstraint.locator('select').selectOption('theta')

  await page.locator('[data-field="loads[0].type"]').selectOption('beam-uniform')
  await page.locator('[data-field="loads[0].elementId"]').fill('1')
  await page.locator('[data-field="loads[0].qY"]').fill('-10')
  await page.locator('[data-add-load="beam-uniform"]').click()
  await page.locator('[data-field="loads[1].elementId"]').fill('2')
  await page.locator('[data-field="loads[1].qY"]').fill('-10')
  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await page.locator('[data-detail="displacements"] summary').click()
  await page.locator('[data-detail="reactions"] summary').click()

  await expectTableValues(page.getByTestId('displacement-table'), [
    { label: '节点转角 θ', objectId: '3', expected: 0.00833333333333, relativeTolerance: 1e-7 },
  ])
  await expectTableValues(page.getByTestId('reaction-table'), [
    { label: '支座反力 Fy', objectId: '1', expected: 25_000, relativeTolerance: 1e-7 },
    { label: '支座反力矩 Mz', objectId: '1', expected: 20_000_000, relativeTolerance: 1e-7 },
    { label: '支座反力 Fy', objectId: '3', expected: 15_000, relativeTolerance: 1e-7 },
  ])
  await expectNoInvalidNumericText(page)
})

test('移动端 390×844 展开结果表后字号、末列和数值文本可读', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', '冻结 UI-02 只在精确移动视口执行')
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 })

  const unitPreset = page.getByTestId('structural-unit-preset')
  const unitButtons = unitPreset.getByRole('button')
  await expect(unitButtons).toHaveCount(2)
  await expect(unitButtons.nth(0)).toBeVisible()
  await expect(unitButtons.nth(1)).toBeVisible()
  const engineeringPreset = unitPreset.getByRole('button', { name: 't–mm–MPa–N–s' })
  const siPreset = unitPreset.getByRole('button', { name: 'SI（kg–m–Pa–N–s）' })
  const beamLength = page.locator('[data-field="nodes[2].x"]')
  await expect(beamLength).toHaveValue('4000')
  await siPreset.click()
  await expect(beamLength).toHaveValue('4')
  await engineeringPreset.click()
  await expect(beamLength).toHaveValue('4000')

  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await page.locator('[data-detail="displacements"] summary').click()
  const displacementTable = page.getByTestId('displacement-table')
  await expectLastColumnReadable(displacementTable)
  await expectNoDiagramLabelCollisions(page)

  await page.locator('[data-module-id="truss"]').click()
  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await page.locator('[data-detail="elements"] summary').click()
  const elementTable = page.getByTestId('element-table')
  await expectLastColumnReadable(elementTable)
  await expectNoDiagramLabelCollisions(page)

  const minimumFonts = await page.locator('.structural-results table :is(th, td), .structure-diagram text, .structure-diagram .legend-item').evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)))
  expect(minimumFonts.length).toBeGreaterThan(0)
  expect(Math.min(...minimumFonts)).toBeGreaterThanOrEqual(12)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const diagramOverflow = await page.locator('.structure-diagram').evaluate((element) =>
    element.scrollWidth - element.clientWidth)
  expect(diagramOverflow).toBeLessThanOrEqual(0)
  await expectNoInvalidNumericText(page)
})
