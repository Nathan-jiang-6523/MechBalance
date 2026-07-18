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
  await expect(page.getByTestId('math-formula')).toHaveCount(5)
  await expect(page.locator('.assumption-panel .katex').first()).toBeVisible()
  await expect(page.locator('.assumption-panel math').first()).toBeAttached()

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

test('轴向拉压与完全约束温变可计算', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /轴向与温变/ }).click()
  await expect(page.getByRole('heading', { name: '轴向拉压、伸长与温度变形' })).toBeVisible()
  await page.getByRole('button', { name: '计算轴向响应' }).click()
  await expect(page.getByTestId('total-deformation')).toContainText('0.65 mm')

  await page.getByLabel('端部边界', { exact: true }).selectOption('fullyRestrained')
  await expect(page.getByLabel('轴向力')).toHaveCount(0)
  await expect(page.getByText(/外加轴力输入已停用/)).toBeVisible()
  await page.getByRole('button', { name: '计算轴向响应' }).click()
  await expect(page.getByTestId('constraint-force')).toContainText('-120000 N')
  await page.screenshot({ path: testInfo.outputPath('axial-thermal.png'), fullPage: true })
})

test('圆轴扭转与功率转矩转速关系可计算', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /圆轴扭转/ }).click()
  await expect(page.getByRole('heading', { name: '圆轴扭转与传动功率' })).toBeVisible()
  await expect(page.getByLabel('杨氏模量', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('泊松比', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('剪切模量', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '计算圆轴扭转' }).click()
  await expect(page.getByTestId('shaft-results')).toContainText('40.744')
  await expect(page.getByTestId('shaft-results')).toContainText('76923.077')

  await page.getByRole('button', { name: '求解传动关系' }).click()
  await expect(page.getByTestId('power-results')).toContainText('63661.977')
  await expect(page.getByTestId('power-results')).toContainText('1500.000')
  await page.screenshot({ path: testInfo.outputPath('torsion-power.png'), fullPage: true })
})

test('平面应力莫尔圆与弯扭组合共享强度准则', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /应力与莫尔圆/ }).click()
  await expect(page.getByRole('heading', { name: '平面应力与弯扭组合' })).toBeVisible()
  await page.getByRole('button', { name: '计算', exact: true }).click()
  await expect(page.getByText('σ1 = 100.000')).toBeVisible()
  await expect(page.getByText('σVM = 100.000')).toBeVisible()
  const mohrCircle = page.getByRole('img', { name: '平面应力莫尔圆与原始应力点' })
  await expect(mohrCircle).toBeVisible()

  const expectNoLabelOverlap = async (): Promise<void> => {
    const overlaps = await mohrCircle.evaluate((svg) => {
      const labels = [...svg.querySelectorAll<SVGGraphicsElement>('[data-mohr-label]')]
        .map((element) => ({ text: element.textContent?.trim() ?? '', box: element.getBoundingClientRect() }))
        .filter(({ text, box }) => text !== '' && box.width > 0 && box.height > 0)
      const collisions: string[] = []
      for (let first = 0; first < labels.length; first += 1) {
        for (let second = first + 1; second < labels.length; second += 1) {
          const a = labels[first]!
          const b = labels[second]!
          const intersects = a.box.left < b.box.right - 1
            && a.box.right > b.box.left + 1
            && a.box.top < b.box.bottom - 1
            && a.box.bottom > b.box.top + 1
          if (intersects) collisions.push(`${a.text} <> ${b.text}`)
        }
      }
      return collisions
    })
    expect(overlaps).toEqual([])
  }

  await expectNoLabelOverlap()
  const planeInputs = page.locator('.input-panel .field-grid input')
  for (const [sigmaX, sigmaY, tauXy] of [['0', '0', '50'], ['80', '80', '0']]) {
    await planeInputs.nth(0).fill(sigmaX)
    await planeInputs.nth(1).fill(sigmaY)
    await planeInputs.nth(2).fill(tauXy)
    await page.getByRole('button', { name: '计算', exact: true }).click()
    await expectNoLabelOverlap()
  }

  await page.getByRole('button', { name: '圆轴弯扭组合' }).click()
  await page.getByRole('button', { name: '计算', exact: true }).click()
  await expect(page.getByText('选定外缘弯曲正应力')).toBeVisible()
  await expect(page.getByText('Tresca 等效应力')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('stress-mohr.png'), fullPage: true })
})

test('欧拉压杆按显式边界和弱轴输出结果', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: /压杆稳定/ }).click()
  await expect(page.getByRole('heading', { name: '欧拉压杆稳定及长细比' })).toBeVisible()
  await page.getByRole('button', { name: '计算稳定性' }).click()
  await expect(page.getByText('y 轴')).toBeVisible()
  await expect(page.getByText('66.620 kN')).toBeVisible()
  await expect(page.getByText(/未配置项目\/规范长细比阈值/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('buckling.png'), fullPage: true })
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
