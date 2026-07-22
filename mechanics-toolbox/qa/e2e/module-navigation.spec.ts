import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseUrl = pathToFileURL(resolve('dist/index.html')).href

test('main 保留三大力学模块并可逐级进入计算器', async ({ page }) => {
  await page.goto(releaseUrl)

  const moduleNavigation = page.getByRole('region', { name: '三大力学计算模块' })
  await expect(moduleNavigation.getByRole('button')).toHaveCount(3)
  await expect(moduleNavigation.getByRole('button', { name: /截面信息计算/ })).toBeVisible()
  await expect(moduleNavigation.getByRole('button', { name: /板壳力学计算/ })).toBeVisible()
  await expect(moduleNavigation.getByRole('button', { name: /结构力学计算/ })).toBeVisible()

  await moduleNavigation.getByRole('button', { name: /板壳力学计算/ }).click()
  await expect(page.getByRole('heading', { name: '薄壁圆筒膜应力工作台' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '当前模块计算器' })).toContainText('板壳屈曲')

  await moduleNavigation.getByRole('button', { name: /结构力学计算/ }).click()
  await expect(page.getByRole('heading', { name: '1D 梁分析工作台', level: 1 })).toBeVisible()
  const structuralNavigation = page.getByRole('navigation', { name: '当前模块计算器' })
  await expect(structuralNavigation).toContainText('影响线')
  await expect(structuralNavigation).toContainText('移动荷载')
  await expect(structuralNavigation).toContainText('平面桁架')
  await expect(structuralNavigation).toContainText('平面刚架')
  await structuralNavigation.getByRole('button', { name: /平面刚架/ }).click()
  await expect(page.getByRole('heading', { name: '平面刚架分析工作台', level: 1 })).toBeVisible()

  await moduleNavigation.getByRole('button', { name: /截面信息计算/ }).click()
  await expect(page.getByRole('heading', { name: '截面性质工作台' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '当前模块计算器' })).toContainText('梁综合计算')
})
