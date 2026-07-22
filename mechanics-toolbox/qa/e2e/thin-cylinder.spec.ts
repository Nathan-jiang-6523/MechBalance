import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test.beforeEach(async ({ page }) => {
  await page.goto(releaseUrl)
  await page.getByRole('button', { name: /板壳力学计算/ }).click()
  await page.getByRole('navigation', { name: '当前模块计算器' })
    .getByRole('button', { name: /薄壁圆筒/ }).click()
  await expect(page.getByRole('heading', { name: '薄壁圆筒膜应力', exact: true })).toBeVisible()
})

test('端部必选，封闭/开口压力轴向应力区分且旧结果失效', async ({ page }) => {
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByRole('alert')).toContainText('必须显式选择端面压力传力状态')

  await page.getByLabel('封闭承压端盖').check()
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByTestId('thin-cylinder-σθ')).toContainText('200.000 MPa')
  await expect(page.getByTestId('thin-cylinder-σz')).toContainText('100.000 MPa')
  await expect(page.getByTestId('thin-cylinder-σVM')).toContainText('173.205 MPa')

  await page.getByLabel('开口 / 无承压端盖').check()
  await expect(page.getByTestId('thin-cylinder-results')).toHaveCount(0)
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByTestId('thin-cylinder-σz')).toContainText('0.000 MPa')

  await page.getByLabel('厚度').fill('')
  await expect(page.getByTestId('thin-cylinder-results')).toHaveCount(0)
})

test('工程/SI 单位往返保留物理结果和边界', async ({ page }) => {
  const engineering = page.getByRole('button', { name: 't–mm–s–N–MPa' })
  const si = page.getByRole('button', { name: 'SI（kg–m–s–N–Pa）' })
  await expect(engineering).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('封闭承压端盖').check()
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()

  await si.click()
  await expect(si).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('中面半径')).toHaveValue('1')
  await expect(page.getByLabel('厚度')).toHaveValue('0.01')
  await expect(page.getByLabel('内压')).toHaveValue('2000000')
  await expect(page.getByLabel('封闭承压端盖')).toBeChecked()
  await expect(page.getByTestId('thin-cylinder-σθ')).toContainText('2.00000e8 Pa')

  await engineering.click()
  await expect(page.getByLabel('中面半径')).toHaveValue('1000')
  await expect(page.getByLabel('厚度')).toHaveValue('10')
  await expect(page.getByLabel('内压')).toHaveValue('2')
  await expect(page.getByTestId('thin-cylinder-σθ')).toContainText('200.000 MPa')
})

test('外压强警告、薄壁阈值阻断及移动端无横向溢出', async ({ page }, testInfo) => {
  await page.getByLabel('封闭承压端盖').check()
  await page.getByRole('textbox', { name: '内压', exact: true }).fill('0')
  await page.getByRole('textbox', { name: '外压', exact: true }).fill('2')
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByText('仅计算膜应力，未校核外压失稳；不得据此判断结构安全。')).toBeVisible()
  await expect(page.getByTestId('thin-cylinder-σθ')).toContainText('-200.000 MPa')

  await page.getByRole('textbox', { name: '内压', exact: true }).fill('1')
  await page.getByRole('textbox', { name: '外压', exact: true }).fill('0')
  await page.getByLabel('厚度').fill('50')
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByText(/恰处薄壁适用上限/)).toBeVisible()
  await expect(page.getByTestId('thin-wall-ratio')).toContainText('0.050')

  await page.getByLabel('厚度').fill('50.05')
  await page.getByRole('button', { name: '计算薄壁圆筒' }).click()
  await expect(page.getByRole('alert')).toContainText('t/r 超过 0.05')
  await expect(page.getByTestId('thin-cylinder-results')).toHaveCount(0)

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
  const diagram = page.getByTestId('thin-cylinder-diagram')
  await expect(diagram).toBeVisible()
  const labelOverlaps = await diagram.locator('svg').evaluate((svg) => {
    const labels = [...svg.querySelectorAll<SVGGraphicsElement>('text')]
      .map((element) => ({ text: element.textContent?.trim() ?? '', box: element.getBoundingClientRect() }))
      .filter(({ text, box }) => text !== '' && box.width > 0 && box.height > 0)
    const collisions: string[] = []
    for (let first = 0; first < labels.length; first += 1) {
      for (let second = first + 1; second < labels.length; second += 1) {
        const a = labels[first]!
        const b = labels[second]!
        if (a.box.left < b.box.right - 1 && a.box.right > b.box.left + 1
          && a.box.top < b.box.bottom - 1 && a.box.bottom > b.box.top + 1) {
          collisions.push(`${a.text} <> ${b.text}`)
        }
      }
    }
    return collisions
  })
  expect(labelOverlaps).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('thin-cylinder.png'), fullPage: true })
})
