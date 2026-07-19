import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /圆板弯曲/ }).click()
  await expect(page.getByRole('heading', { name: '实心圆板轴对称弯曲', exact: true })).toBeVisible()
})

test('边界必选且固支圆板基准正确', async ({ page }) => {
  await page.getByRole('button', { name: '计算圆板' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择圆板周边条件')
  await page.getByLabel('周边固支').check()
  await page.getByRole('button', { name: '计算圆板' }).click()
  const result = page.getByTestId('circular-plate-results')
  await expect(result).toContainText('1.066 mm')
  await expect(result).toContainText('812.500 / 812.500 N·mm/mm')
  await expect(result).toContainText('12.188 / 12.188 MPa')
  await expect(result).toContainText('P3-CP-CLAMPED-UNIFORM-1')
})

test('简支结果、单位往返、越界与移动布局', async ({ page }) => {
  await page.getByLabel('周边简支').check()
  await page.getByRole('button', { name: '计算圆板' }).click()
  await expect(page.getByTestId('circular-plate-results')).toContainText('4.348 mm')
  await page.getByRole('button', { name: 'SI（kg–m–s–N–Pa）' }).click()
  await expect(page.getByRole('textbox', { name: '圆板半径', exact: true })).toHaveValue('1')
  await expect(page.getByLabel('周边简支')).toBeChecked()
  await page.getByLabel('圆板求值半径').fill('1.001')
  await page.getByRole('button', { name: '计算圆板' }).click()
  await expect(page.getByRole('alert')).toContainText('求值半径')
  await expect(page.getByTestId('circular-plate-results')).toHaveCount(0)
  const viewport = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})
