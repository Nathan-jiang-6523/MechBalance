import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /矩形板弯曲/ }).click()
  await expect(page.getByRole('heading', { name: '矩形薄板弯曲', exact: true })).toBeVisible()
})

test('边界必选且 SSSS Navier 基准正确', async ({ page }) => {
  await page.getByRole('button', { name: '计算矩形板' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择矩形板边界')
  await page.getByLabel('四边简支 SSSS').check()
  await page.getByRole('button', { name: '计算矩形板' }).click()
  const result = page.getByTestId('rectangular-plate-results')
  await expect(result).toContainText('Navier 级数解')
  await expect(result).toContainText('0.277 mm')
  await expect(result).toContainText('478.864 / 478.864 / 0.000 N·mm/mm')
  await expect(result).toContainText('7.183 / 7.183 / 0.000 MPa')
})

test('CCCC 明示近似、单位往返、越界与移动布局', async ({ page }) => {
  await page.getByLabel('四边固支 CCCC').check()
  await page.getByRole('button', { name: '计算矩形板' }).click()
  await expect(page.getByTestId('rectangular-plate-results')).toContainText('里茨近似')
  await expect(page.getByTestId('rectangular-plate-results')).toContainText('不是精确解')
  await page.getByRole('button', { name: 'SI（kg–m–s–N–Pa）' }).click()
  await expect(page.getByLabel('矩形板长度 a')).toHaveValue('1')
  await expect(page.getByLabel('四边固支 CCCC')).toBeChecked()
  await page.getByLabel('矩形板求值 x').fill('0.501')
  await page.getByRole('button', { name: '计算矩形板' }).click()
  await expect(page.getByRole('alert')).toContainText('板内')
  const viewport = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})
