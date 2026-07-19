import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /厚壁圆筒/ }).click()
  await expect(page.getByRole('heading', { name: '厚壁圆筒 Lamé 解', exact: true })).toBeVisible()
})

test('轴向状态必选且封闭端满足表面压力边界', async ({ page }) => {
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择轴向状态')
  await page.getByLabel('封闭承压端').check()
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()

  const inner = page.getByTestId('lame-point-内表面')
  const middle = page.getByTestId('lame-point-求值位置')
  const outer = page.getByTestId('lame-point-外表面')
  await expect(inner).toContainText('-100.000 MPa')
  await expect(inner).toContainText('166.667 MPa')
  await expect(inner).toContainText('0.093 mm')
  await expect(middle).toContainText('-25.926 MPa')
  await expect(middle).toContainText('92.593 MPa')
  await expect(outer).toContainText('0.000 MPa')
  await expect(page.getByTestId('lame-inner-residual')).toContainText('0.000 MPa')
  await expect(page.getByTestId('lame-outer-residual')).toContainText('0.000 MPa')
  await expect(page.getByRole('img', { name: '径向环向和轴向应力随半径变化曲线' })).toBeVisible()
})

test('开口、封闭、平面应变互斥且平面应变禁用轴力', async ({ page }) => {
  await page.getByLabel('开口端').check()
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('0.000 MPa')
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('0.075 mm')

  await page.getByLabel('封闭承压端').check()
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('33.333 MPa')
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('0.068 mm')

  await page.getByLabel('平面应变 εz=0').check()
  await expect(page.getByLabel('Lamé 外加轴力')).toBeDisabled()
  await expect(page.getByText('平面应变已约束 εz=0，不再叠加任意轴力。')).toBeVisible()
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('20.000 MPa')
  await expect(page.getByTestId('lame-point-求值位置')).toContainText('0.071 mm')
})

test('工程/SI 往返保留几何、轴向状态与结果', async ({ page }) => {
  await page.getByLabel('封闭承压端').check()
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  const engineering = page.getByRole('button', { name: 't–mm–s–N–MPa' })
  const si = page.getByRole('button', { name: 'SI（kg–m–s–N–Pa）' })
  await si.click()
  await expect(page.getByLabel('Lamé 内半径')).toHaveValue('0.1')
  await expect(page.getByLabel('Lamé 外半径')).toHaveValue('0.2')
  await expect(page.getByLabel('Lamé 求值半径')).toHaveValue('0.15')
  await expect(page.getByLabel('Lamé 内压')).toHaveValue('100000000')
  await expect(page.getByLabel('封闭承压端')).toBeChecked()
  await expect(page.getByTestId('lame-point-内表面')).toContainText('-1.00000e8 Pa')
  await engineering.click()
  await expect(page.getByLabel('Lamé 内半径')).toHaveValue('100')
  await expect(page.getByLabel('Lamé 外半径')).toHaveValue('200')
  await expect(page.getByTestId('lame-point-内表面')).toContainText('-100.000 MPa')
})

test('非法半径阻断、薄壁极限提示、移动布局及图示通过', async ({ page }, testInfo) => {
  await page.getByLabel('封闭承压端').check()
  await page.getByLabel('Lamé 求值半径').fill('99.9')
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByRole('alert')).toContainText('ri≤r≤ro')
  await expect(page.getByTestId('lame-cylinder-results')).toHaveCount(0)

  await page.getByLabel('Lamé 内半径').fill('990')
  await page.getByLabel('Lamé 外半径').fill('1010')
  await page.getByLabel('Lamé 求值半径').fill('1000')
  await page.getByLabel('Lamé 内压').fill('1')
  await page.getByRole('button', { name: '计算 Lamé 响应' }).click()
  await expect(page.getByText(/当前几何满足薄壁判据/)).toBeVisible()
  const comparison = page.getByTestId('lame-thin-comparison')
  await expect(comparison).toContainText('1.005000%')
  await expect(comparison).toContainText('1.990000%')

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
  const diagram = page.getByTestId('lame-cylinder-diagram')
  const overlaps = await diagram.locator('svg').evaluate((svg) => {
    const labels = [...svg.querySelectorAll<SVGGraphicsElement>('text')]
      .map((element) => ({ text: element.textContent?.trim() ?? '', box: element.getBoundingClientRect() }))
      .filter(({ text, box }) => text && box.width > 0 && box.height > 0)
    const collisions: string[] = []
    for (let first = 0; first < labels.length; first += 1) for (let second = first + 1; second < labels.length; second += 1) {
      const a = labels[first]!
      const b = labels[second]!
      if (a.box.left < b.box.right - 1 && a.box.right > b.box.left + 1
        && a.box.top < b.box.bottom - 1 && a.box.bottom > b.box.top + 1) collisions.push(`${a.text} <> ${b.text}`)
    }
    return collisions
  })
  expect(overlaps).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('lame-cylinder.png'), fullPage: true })
})
