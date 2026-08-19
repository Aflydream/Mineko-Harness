// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { DropOverlay } from '../src/DropOverlay.tsx'

afterEach(cleanup)

describe('DropOverlay', () => {
  it('portals the invitation with its title and limits desc to the body', () => {
    const view = render(
      <DropOverlay open disabled={false} labels={{ title: '图片拖动到此处即可添加', desc: '最多 20 张，每张 5MB' }} />,
    )
    const overlay = view.getByRole('status')
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay.textContent).toContain('图片拖动到此处即可添加')
    expect(overlay.textContent).toContain('最多 20 张，每张 5MB')
  })

  it('omits the desc line when none is resolved', () => {
    const view = render(<DropOverlay open disabled={false} labels={{ title: '图片拖动到此处即可添加' }} />)
    expect(view.getByRole('status').textContent).toBe('图片拖动到此处即可添加')
  })

  it('drops the desc and switches the illustration while disabled', () => {
    const enabled = render(
      <DropOverlay open disabled={false} labels={{ title: '拖入', desc: '限制' }} />,
    )
    const enabledSvg = enabled.getByRole('status').querySelector('svg')!.innerHTML
    enabled.unmount()
    const disabled = render(
      <DropOverlay open disabled labels={{ title: '当前无法添加图片', desc: '限制' }} />,
    )
    const overlay = disabled.getByRole('status')
    expect(overlay.textContent).toBe('当前无法添加图片')
    expect(overlay.querySelector('svg')!.innerHTML).not.toBe(enabledSvg)
  })

  it('retains the mask through exit and unmounts at animation end', () => {
    const labels = { title: '拖入', desc: '限制' }
    const view = render(<DropOverlay open disabled={false} labels={labels} />)
    const overlay = view.getByRole('status')
    view.rerender(<DropOverlay open={false} disabled={false} labels={labels} />)
    expect(view.getByRole('status', { hidden: true })).toBe(overlay)
    expect(overlay.className).toMatch(/closing/)
    fireEvent.animationEnd(overlay)
    expect(view.queryByRole('status', { hidden: true })).toBeNull()
  })

  it('closes immediately when reduced motion is preferred', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    try {
      const labels = { title: '拖入' }
      const view = render(<DropOverlay open disabled={false} labels={labels} />)
      view.rerender(<DropOverlay open={false} disabled={false} labels={labels} />)
      expect(view.queryByRole('status', { hidden: true })).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })
})
