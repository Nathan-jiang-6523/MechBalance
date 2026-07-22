import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test('全部 P3 页面离线、结果完整且桌面/移动截图无溢出', async ({ page }, testInfo) => {
  const externalRequests: string[] = []
  page.on('request', (request) => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()) })
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /板壳力学计算/ }).click()
  const scenarios = [
    { nav: /薄壁圆筒/, boundary: '封闭承压端盖', calculate: '计算薄壁圆筒', result: 'thin-cylinder-results', slug: 'thin-cylinder' },
    { nav: /厚壁圆筒/, boundary: '封闭承压端', calculate: '计算 Lamé 响应', result: 'lame-cylinder-results', slug: 'lame-cylinder' },
    { nav: /圆板弯曲/, boundary: '周边固支', calculate: '计算圆板', result: 'circular-plate-results', slug: 'circular-plate' },
    { nav: /矩形板弯曲/, boundary: '四边简支 SSSS', calculate: '计算矩形板', result: 'rectangular-plate-results', slug: 'rectangular-plate' },
  ] as const
  const calculatorNavigation = page.getByRole('navigation', { name: '当前模块计算器' })
  for (const scenario of scenarios) {
    await calculatorNavigation.getByRole('button', { name: scenario.nav }).click()
    await page.getByLabel(scenario.boundary, { exact: true }).check()
    await page.getByRole('button', { name: scenario.calculate }).click()
    await expect(page.getByTestId(scenario.result)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${scenario.slug}.png`), fullPage: true })
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(width.scroll).toBeLessThanOrEqual(width.client)
  }
  await calculatorNavigation.getByRole('button', { name: /板壳屈曲/ }).click()
  await page.getByLabel('矩形板', { exact: true }).check()
  await page.getByLabel('四边简支、x 向均匀压缩', { exact: true }).check()
  await page.getByRole('button', { name: '计算屈曲临界值' }).click()
  await expect(page.getByTestId('buckling-results')).toContainText('理想弹性估计')
  await page.screenshot({ path: testInfo.outputPath('plate-shell-buckling.png'), fullPage: true })
  const finalWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(finalWidth.scroll).toBeLessThanOrEqual(finalWidth.client)
  expect(externalRequests).toEqual([])
})
