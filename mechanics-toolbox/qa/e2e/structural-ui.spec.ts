import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /结构力学/ }).click()
  await expect(page.getByRole('heading', { name: '结构分析工作台' })).toBeVisible()
})

test('BEAM-A01 首次计算、单位原子切换和旧结果失效', async ({ page }) => {
  const unitPreset = page.getByTestId('structural-unit-preset')
  await expect(unitPreset).toHaveValue('engineering')
  await expect(page.getByText('等待首次计算')).toBeVisible()

  await page.getByRole('button', { name: '计算结构响应' }).click()
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await expect(page.getByTestId('displacement-table')).toContainText('mm')
  await expect(page.getByTestId('control-table')).toContainText('N·mm')

  await unitPreset.selectOption('si')
  await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
  await expect(page.getByTestId('displacement-table')).toContainText('m')
  await unitPreset.selectOption('engineering')
  await expect(page.getByTestId('displacement-table')).toContainText('mm')

  const firstNodeX = page.locator('.structural-model-editor [data-field="nodes[0].x"]')
  await firstNodeX.fill('')
  await expect(page.getByRole('heading', { name: '计算完成' })).toHaveCount(0)
  await expect(page.getByText('旧结果已清除')).toBeVisible()
})

test('桁架、刚架、影响线和移动荷载均可从冻结算例计算', async ({ page }) => {
  for (const item of [
    { module: 'truss', resultText: '杆件正应力' },
    { module: 'frame', resultText: '支座反力矩' },
    { module: 'influence-line', resultText: 'left（左侧）' },
    { module: 'moving-load', resultText: '控制轴' },
  ]) {
    await page.locator(`[data-module-id="${item.module}"]`).click()
    await page.getByRole('button', { name: '计算结构响应' }).click()
    await expect(page.getByRole('heading', { name: '计算完成' })).toBeVisible()
    await expect(page.locator('.structural-results')).toContainText(item.resultText)
  }
})

test('结构工作台在当前视口内且关键触控目标不小于 44px', async ({ page }) => {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const sizes = await page.locator('.calculator-toolbar select, .calculate-button').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44)
    expect(size.height).toBeGreaterThanOrEqual(44)
  }
})
