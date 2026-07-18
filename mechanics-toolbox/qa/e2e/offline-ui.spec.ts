import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await expect(page.getByText('离线可用')).toBeVisible()
})

test('截面计算、材料覆盖和恢复可用', async ({ page }) => {
  await page.getByRole('button', { name: '计算截面性质' }).click()
  await expect(page.getByText('已计算')).toBeVisible()
  await expect(page.getByText(/Jt =/)).toBeVisible()

  await page.getByLabel('弹性模量 E').fill('70000')
  await expect(page.getByText('已覆盖预设值')).toBeVisible()
  await page.getByRole('button', { name: '恢复预设' }).click()
  await expect(page.getByText('使用预设值')).toBeVisible()
})

test('矩形高度标注不与 x 坐标轴遮挡', async ({ page }) => {
  for (const shape of ['矩形', '空心矩形']) {
    await page.getByRole('tab', { name: shape, exact: true }).click()
    const collisions = await page.locator('.section-diagram').evaluate((diagram) => {
      const heightLabel = diagram.querySelector<SVGGraphicsElement>('[data-dimension="height"]')
      const xAxis = diagram.querySelector<SVGGraphicsElement>('.axis-x')
      const xLabel = diagram.querySelector<SVGGraphicsElement>('.axis-label-x')
      if (!heightLabel || !xAxis || !xLabel) return ['missing-element']

      const heightBox = heightLabel.getBoundingClientRect()
      const overlaps = (target: DOMRect): boolean =>
        heightBox.left < target.right &&
        heightBox.right > target.left &&
        heightBox.top < target.bottom + 2 &&
        heightBox.bottom > target.top - 2

      return [
        overlaps(xAxis.getBoundingClientRect()) ? 'x-axis' : '',
        overlaps(xLabel.getBoundingClientRect()) ? 'x-label' : '',
      ].filter(Boolean)
    })
    expect(collisions, `${shape}高度标注发生遮挡`).toEqual([])
  }
})

test('单位换算与切换清空规则可用', async ({ page }) => {
  await page.getByRole('button', { name: /单位换算/ }).click()
  await page.getByLabel('原单位').selectOption('m')
  await page.getByLabel('目标单位').selectOption('mm')
  await page.getByLabel('输入数值').fill('1.25')
  await expect(page.getByText('1250.000')).toBeVisible()

  await page.getByLabel('目标单位').selectOption('cm')
  await expect(page.getByLabel('输入数值')).toHaveValue('')
})

test('梁综合计算默认算例、自动重算和失效保护可用', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /梁综合计算/ }).click()
  await expect(page.getByRole('heading', { name: '梁与载荷输入' })).toBeVisible()
  await expect(page.locator('.beam-diagram')).toBeVisible()

  await page.getByRole('button', { name: '计算梁响应' }).click()
  await expect(page.getByRole('heading', { name: '反力、内力、变形与应力' })).toBeVisible()
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '左端竖向反力' }),
  ).toContainText('6000.000')
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '右端竖向反力' }),
  ).toContainText('4000.000')
  await expect(
    page.getByTestId('stress-row').filter({ hasText: '最大弯曲正应力绝对值' }),
  ).toContainText('15.000')
  await expect(page.locator('.chart-canvas canvas')).toHaveCount(2)

  await page.getByTestId('second-chart-select').selectOption('deflectionM')
  await expect(page.getByTestId('second-chart-select')).toHaveValue('deflectionM')
  await page.screenshot({ path: testInfo.outputPath('beam-calculator.png'), fullPage: true })

  const firstLoad = page.locator('.load-card[data-load-index="0"]')
  await firstLoad.locator('.field').filter({ hasText: '非负幅值' }).locator('input').fill('20000')
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '左端竖向反力' }),
  ).toContainText('12000.000')

  await page.locator('.beam-input-panel .field').filter({ hasText: '梁长 L' }).locator('input').fill('')
  await expect(page.getByRole('heading', { name: '反力、内力、变形与应力' })).toHaveCount(0)
  await expect(page.getByRole('alert').first()).toContainText('请检查输入')
})

test('梁载荷方向输入模式互斥且页面不产生横向溢出', async ({ page }) => {
  await page.getByRole('button', { name: /梁综合计算/ }).click()
  const mode = page.locator('.beam-input-panel .field').filter({ hasText: '载荷方向输入' }).locator('select')
  await expect(page.getByLabel('载荷方向', { exact: true })).toBeVisible()
  await mode.selectOption('signed')
  await expect(page.getByLabel('载荷方向', { exact: true })).toHaveCount(0)
  await expect(page.locator('.load-card').getByText('带符号数值')).toBeVisible()

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('梁多载荷及载荷单位切换可回归', async ({ page }) => {
  await page.getByRole('button', { name: /梁综合计算/ }).click()
  await page.getByRole('button', { name: '＋集中力' }).click()

  const secondLoad = page.locator('.load-card[data-load-index="1"]')
  await secondLoad.locator('.field').filter({ hasText: '位置 a' }).locator('input').fill('600')
  await secondLoad.locator('.field').filter({ hasText: '非负幅值' }).locator('input').fill('5000')
  await page.getByRole('button', { name: '计算梁响应' }).click()
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '左端竖向反力' }),
  ).toContainText('8000.000')
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '右端竖向反力' }),
  ).toContainText('7000.000')

  await secondLoad.getByLabel('位置单位').selectOption('cm')
  await expect(secondLoad.locator('.field').filter({ hasText: '位置 a' }).locator('input')).toHaveValue('')
  await expect(page.getByRole('heading', { name: '反力、内力、变形与应力' })).toHaveCount(0)
  await secondLoad.locator('.field').filter({ hasText: '位置 a' }).locator('input').fill('60')
  await expect(
    page.getByTestId('reaction-row').filter({ hasText: '左端竖向反力' }),
  ).toContainText('8000.000')
})

test('file 页面无网络请求且视口无横向溢出', async ({ page }) => {
  const networkRequests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) networkRequests.push(request.url())
  })
  await page.reload()
  await expect(page.getByText('离线可用')).toBeVisible()
  expect(networkRequests).toEqual([])

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})
