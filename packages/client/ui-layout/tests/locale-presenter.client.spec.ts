// @vitest-environment jsdom
// LocalePresenter behavior account: the document root's lang follows the
// active locale id, later applies replace the previous value rather than
// accumulating, and dispose restores the lang the markup shipped with.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LocaleSnapshot } from '@aflydream/mnh-client-locale/client'
import { LocalePresenter } from '@aflydream/mnh-client-ui-layout/src/client/locale-presenter.ts'

const MARKUP_LANG = 'zh'

function snapshot(active: 'zh' | 'en'): LocaleSnapshot {
  return { active, locales: [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }], revision: 1 }
}

beforeEach(() => { document.documentElement.lang = MARKUP_LANG })

afterEach(() => { document.documentElement.removeAttribute('lang') })

describe('LocalePresenter', () => {
  it('projects the active locale id onto the document root', () => {
    const presenter = new LocalePresenter()
    presenter.apply(snapshot('en'))
    expect(document.documentElement.lang).toBe('en')
  })

  it('replaces the previous language on a later apply', () => {
    const presenter = new LocalePresenter()
    presenter.apply(snapshot('en'))
    presenter.apply(snapshot('zh'))
    expect(document.documentElement.lang).toBe('zh')
  })

  it('dispose restores the language the markup shipped with', () => {
    const presenter = new LocalePresenter()
    presenter.apply(snapshot('en'))
    presenter.dispose()
    expect(document.documentElement.lang).toBe(MARKUP_LANG)
  })
})
