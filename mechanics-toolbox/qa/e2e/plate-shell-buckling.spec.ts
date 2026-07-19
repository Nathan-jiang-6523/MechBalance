import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /板壳屈曲/ }).click()
  await expect(page.getByRole('heading', { name: '板与圆柱壳屈曲初算', exact: true })).toBeVisible()
})

test('计算对象与边界必选，方板屈曲基准正确', async ({ page }) => {
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择计算对象')
  await page.getByLabel('矩形板', { exact: true }).check()
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择板屈曲边界')
  await page.getByLabel('四边简支、x 向均匀压缩').check()
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  const result = page.getByTestId('buckling-results')
  await expect(result).toContainText('5784.384 N/mm')
  await expect(result).toContainText('289.219 MPa')
  await expect(result).toContainText('控制半波 m × n：1 × 1')
  await expect(result).toContainText('缺陷')
  await expect(result).toContainText('规范或试验折减')
})

test('圆柱壳基准、超薄壳护栏和移动布局', async ({ page }) => {
  await page.getByLabel('圆柱壳', { exact: true }).check()
  await page.getByLabel('简支无加劲圆柱壳、均匀轴压').check()
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  const result = page.getByTestId('buckling-results')
  await expect(result).toContainText('6052.275 N/mm')
  await expect(result).toContainText('1210.455 MPa')
  await expect(result).toContainText('P3-BK-SHELL-NASA-SP8007-AXIAL-1')
  await page.getByLabel('屈曲壳厚度').fill('25.01')
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  await expect(page.getByRole('alert')).toContainText('当前薄壳屈曲模型不适用')
  await expect(page.getByTestId('buckling-results')).toHaveCount(0)
  const viewport = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})
