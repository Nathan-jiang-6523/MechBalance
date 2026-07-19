import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MovingLoadRequest, MovingLoadResultData } from '../../../src/core/structural'
import MovingLoadSchematic from '../../../src/features/structural/components/MovingLoadSchematic.vue'
import { runStructuralCalculation } from '../../../src/features/structural/calculation'
import { getStructuralExample } from '../../../src/features/structural/examples'

function request(): MovingLoadRequest {
  const value = getStructuralExample('ML-A01')
  if (value.analysis !== 'moving-load') throw new Error('moving-load expected')
  return value
}

describe('MovingLoadSchematic', () => {
  it('draws bridge supports, axle loads, spacing, direction and response target', () => {
    const wrapper = mount(MovingLoadSchematic, { props: { request: request(), unitPresetId: 'engineering' } })
    expect(wrapper.get('[data-testid="moving-load-schematic"]').attributes('data-direction')).toBe('left-to-right')
    expect(wrapper.findAll('.support')).toHaveLength(2)
    expect(wrapper.findAll('.moving-axle')).toHaveLength(2)
    expect(wrapper.get('[data-axle-id="front"]').text()).toContain('100000 N')
    expect(wrapper.get('[data-axle-id="rear"]').text()).toContain('60000 N')
    expect(wrapper.get('[data-spacing-index="0"]').text()).toContain('3000 mm')
    expect(wrapper.get('.response-target').attributes('data-response-type')).toBe('left-reaction')
    expect(wrapper.text()).toContain('从左向右（A → B）')
    expect(wrapper.text()).toContain('事件点 + 驻点')
    expect(wrapper.text()).toContain('不伪造完整包络曲线')
  })

  it('reverses physical axle order with right-to-left travel and switches units atomically', async () => {
    const rightToLeft: MovingLoadRequest = {
      ...request(),
      movingLoad: { ...request().movingLoad, direction: 'right-to-left' },
    }
    const wrapper = mount(MovingLoadSchematic, { props: { request: rightToLeft, unitPresetId: 'engineering' } })
    const front = Number(wrapper.get('[data-axle-id="front"]').attributes('data-position'))
    const rear = Number(wrapper.get('[data-axle-id="rear"]').attributes('data-position'))
    expect(front).toBeLessThan(rear)
    expect(wrapper.text()).toContain('从右向左（B → A）')
    await wrapper.setProps({ unitPresetId: 'si' })
    expect(wrapper.get('[data-spacing-index="0"]').text()).toContain('3 m')
  })

  it('shows verified governing positions after calculation and retains bridge-outside axles', () => {
    const solved = runStructuralCalculation(request())
    expect(solved.status).toBe('success')
    if (solved.status === 'error' || solved.structural.analysis !== 'moving-load') return
    const wrapper = mount(MovingLoadSchematic, { props: { request: request(), result: solved.structural } })
    expect(wrapper.get('[data-testid="moving-load-schematic"]').attributes('data-mode')).toBe('governing-control')
    expect(wrapper.get('[data-axle-id="rear"]').attributes('data-position')).toBe('0')
    expect(wrapper.text()).toContain('最大值控制')
    expect(wrapper.text()).toContain('rear')

    const outsideResult: MovingLoadResultData = {
      ...solved.structural,
      axlePositions: solved.structural.axlePositions.map((axle, index) => ({
        ...axle,
        position: { ...axle.position, value: index === 0 ? -1 : 2 },
      })),
    }
    const outside = mount(MovingLoadSchematic, { props: { request: request(), result: outsideResult } })
    expect(outside.get('[data-axle-id="front"]').attributes('data-on-bridge')).toBe('false')
    expect(outside.get('[data-axle-id="front"]').classes()).toContain('outside')
  })
})
