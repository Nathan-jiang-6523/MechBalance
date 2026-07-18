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
