/**
 * Global locale DOM applier: projects the resolved LocaleSnapshot onto the
 * document root's `lang`. That attribute is what a screen reader reads the
 * page in, what CSS font stacks and line-breaking select between CJK and
 * Latin behavior, and what the browser's translation offer keys off — none of
 * which the shipped index markup can know, because the active locale follows
 * the browser's languages and the Host-backed preference. Pure DOM writes, no
 * React involvement; the presenter is the document's only writer of `lang`
 * and restores the markup's own value on dispose.
 */
import type { LocaleSnapshot } from '@aflydream/mnh-client-locale/client'

/** Applies locale snapshots to the document; one instance per plugin fiber. */
export class LocalePresenter {
  /** The `lang` the document carried before the first apply (its retraction value). */
  private readonly documentLang = document.documentElement.lang

  /**
   * Project a snapshot onto the document root. Locale ids are the language
   * subtag itself (`zh`, `en`), so the active id is already a valid tag.
   * @param snapshot - resolved locale snapshot from ctx.locale.
   */
  apply(snapshot: LocaleSnapshot): void {
    document.documentElement.lang = snapshot.active
  }

  /** Restore the `lang` the document carried before the first apply. */
  dispose(): void {
    document.documentElement.lang = this.documentLang
  }
}
