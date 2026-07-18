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
