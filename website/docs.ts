/** Canonical publication manifest for the tutorial-only documentation website. */

/** Locale key used by the VitePress site. */
export type DocsLocale = 'root' | 'en'

/** Sidebar collection rendered for one locale and top-level module. */
export type DocsSidebar = 'zh-guide' | 'zh-develop' | 'en-guide' | 'en-develop'

/** A tutorial page projected into the VitePress source tree. */
export interface DocsPage {
  /** VitePress locale whose route tree owns this projection. */
  locale: DocsLocale
  /** Language of the canonical source projected at this route. */
  contentLocale: 'zh-CN' | 'en-US'
  /** Repository-relative canonical Markdown source. */
  source: string
  /** VitePress route, including the `.md` suffix. */
  route: string
  /** Navigation label shown in the sidebar. */
  label: string
  /** Sidebar collection that owns the page, or null for a locale home page. */
  sidebar: DocsSidebar | null
  /** Section label within the sidebar. */
  section: string
  /** Stable order within the section. */
  order: number
  /** Heading levels included in this page's VitePress outline. */
  outline?: number | readonly [number, number] | 'deep' | false
  /** Additional repository paths that resolve to this page. */
  sourceAliases?: string[]
}

interface PairedPage {
  /** English side of a sibling `foo.md` / `foo.zh.md` pair. */
  source: string
  route: string
  label: Record<DocsLocale, string>
  sidebar: Record<DocsLocale, DocsSidebar | null>
  section: Record<DocsLocale, string>
  order: number
  outline?: DocsPage['outline']
  sourceAliases?: string[]
}

function pairedPages(pages: PairedPage[]): DocsPage[] {
  return pages.flatMap(page => (['root', 'en'] as const).map(locale => ({
    locale,
    contentLocale: locale === 'root' ? 'zh-CN' : 'en-US',
    source: locale === 'root' ? page.source.replace(/\.md$/, '.zh.md') : page.source,
    route: locale === 'root' ? page.route : `en/${page.route}`,
    label: page.label[locale],
    sidebar: page.sidebar[locale],
    section: page.section[locale],
    order: page.order,
    ...(page.outline === undefined ? {} : { outline: page.outline }),
    sourceAliases: [
      ...(page.sourceAliases ?? []),
      locale === 'root' ? page.source : page.source.replace(/\.md$/, '.zh.md'),
    ],
  })))
}

const homeAndGuide = pairedPages([
  {
    source: 'docs/user/index.md',
    route: 'index.md',
    label: { root: 'MiNeko Harness', en: 'MiNeko Harness' },
    sidebar: { root: null, en: null },
    section: { root: '首页', en: 'Home' },
    order: 0,
  },
  {
    source: 'docs/user/guide/index.md',
    route: 'guide/quickstart.md',
    label: { root: '使用桌面与 Web 界面', en: 'Use the desktop and Web interface' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 1,
    sourceAliases: ['docs/user/guide'],
  },
  {
    source: 'docs/user/guide/providers.md',
    route: 'guide/providers.md',
    label: { root: '配置模型', en: 'Configure models' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 2,
  },
  {
    source: 'docs/user/guide/python-sdk.md',
    route: 'guide/python-sdk.md',
    label: { root: 'Python SDK', en: 'Python SDK' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: 'SDK', en: 'SDK' },
    order: 1,
  },
])

const develop = pairedPages([
  {
    source: 'docs/user/develop/basic/index.md',
    route: 'develop/basic/index.md',
    label: { root: '第一个 Harness 插件', en: 'Your first Harness plugin' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 1,
    sourceAliases: ['docs/user/develop/basic'],
  },
  {
    source: 'docs/user/develop/basic/tool.md',
    route: 'develop/basic/tool.md',
    label: { root: '开发一个 Tool', en: 'Build a tool' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 2,
  },
  {
    source: 'docs/user/develop/basic/config.md',
    route: 'develop/basic/config.md',
    label: { root: '插件配置', en: 'Plugin configuration' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 3,
  },
  {
    source: 'docs/user/develop/basic/publish.md',
    route: 'develop/basic/publish.md',
    label: { root: '打包与安装插件', en: 'Package and install' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 4,
  },
  {
    source: 'docs/user/develop/framework/index.md',
    route: 'develop/framework/index.md',
    label: { root: '插件与生命周期', en: 'Plugin lifecycle' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 1,
    sourceAliases: ['docs/user/develop/framework'],
  },
  {
    source: 'docs/user/develop/framework/service.md',
    route: 'develop/framework/service.md',
    label: { root: '服务与依赖', en: 'Services and dependencies' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 2,
  },
  {
    source: 'docs/user/develop/framework/events.md',
    route: 'develop/framework/events.md',
    label: { root: '事件系统', en: 'Event system' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 3,
  },
  {
    source: 'docs/user/develop/practice/index.md',
    route: 'develop/practice/index.md',
    label: { root: '能力的三层拆分', en: 'Capability layering' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '实战', en: 'Practice' },
    order: 1,
    sourceAliases: ['docs/user/develop/practice'],
  },
  {
    source: 'docs/user/develop/practice/llm-adapter.md',
    route: 'develop/practice/llm-adapter.md',
    label: { root: 'LLM 适配器', en: 'LLM adapter' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '实战', en: 'Practice' },
    order: 2,
  },
])

const cordisTutorial = pairedPages(([
  ['index.md', '总览', 'Overview'],
  ['01-first-plugin.md', '1. 第一个插件', '1. Your first plugin'],
  ['02-lifecycle-and-effects.md', '2. 生命周期与副作用', '2. Lifecycle and effects'],
  ['03-services.md', '3. 服务', '3. Services'],
  ['04-events.md', '4. 事件', '4. Events'],
  ['05-config.md', '5. 配置', '5. Configuration'],
  ['06-composition-and-hmr.md', '6. 组合与热重载', '6. Composition and HMR'],
  ['07-into-the-harness.md', '7. 进入 Harness', '7. Into the harness'],
] as const).map(([file, rootLabel, enLabel], order): PairedPage => ({
  source: `docs/cordis-tutorial/${file}`,
  route: `develop/cordis-tutorial/${file}`,
  label: { root: rootLabel, en: enLabel },
  sidebar: { root: 'zh-develop', en: 'en-develop' },
  section: { root: 'Cordis 框架教程', en: 'Cordis framework tutorial' },
  order,
  ...(file === 'index.md' ? { sourceAliases: ['docs/cordis-tutorial'] } : {}),
})))

const cookbook = pairedPages(([
  ['adding-a-package.md', '新增 Package', 'Adding a package'],
  ['adding-a-tool.md', '新增 Tool', 'Adding a tool'],
  ['adding-an-llm-adapter.md', '新增 LLM Adapter', 'Adding an LLM adapter'],
  ['adding-a-conversation-node.md', '新增 Conversation Node', 'Adding a Conversation Node'],
  ['adding-a-vendored-package.md', '新增 Vendored Package', 'Adding a vendored package'],
  ['extension-cookbook.md', '扩展模式', 'Extension patterns'],
  ['maintaining-mnh-code-review.md', '维护 Code Review', 'Maintaining code review'],
  ['responding-to-pr-review-on-a-stack.md', '处理堆叠 PR 评审', 'Responding to stacked PR review'],
] as const).map(([file, rootLabel, enLabel], order): PairedPage => ({
  source: `docs/cookbook/${file}`,
  route: `develop/cookbook/${file}`,
  label: { root: rootLabel, en: enLabel },
  sidebar: { root: 'zh-develop', en: 'en-develop' },
  section: { root: '开发手册', en: 'Cookbook' },
  order,
})))

/** A sidebar group, matched to pages by `label`. */
export interface DocsSection {
  /** Group heading, equal to the `section` field of every page it holds. */
  label: string
  /** Render the group collapsed until it holds the page being read. */
  collapsed?: boolean
}

const sections: Record<DocsLocale, readonly DocsSection[]> = {
  root: [
    { label: '入门' }, { label: 'SDK' },
    { label: '基础' }, { label: '框架能力' }, { label: '实战' },
    { label: 'Cordis 框架教程', collapsed: true }, { label: '开发手册', collapsed: true },
  ],
  en: [
    { label: 'Guide' }, { label: 'SDK' },
    { label: 'Basics' }, { label: 'Framework' }, { label: 'Practice' },
    { label: 'Cordis framework tutorial', collapsed: true }, { label: 'Cookbook', collapsed: true },
  ],
}

/** Resolve one sidebar group's placement and collapse behavior. */
export function sectionSpec(locale: DocsLocale, label: string): DocsSection & { index: number } {
  const declared = sections[locale]
  const section = declared.find(candidate => candidate.label === label)
  if (section === undefined) throw new Error(`Sidebar section "${label}" has no placement in the ${locale} locale.`)
  return { ...section, index: declared.indexOf(section) }
}

/** Every canonical tutorial page published by the documentation website. */
export const docsPages: DocsPage[] = [...homeAndGuide, ...develop, ...cordisTutorial, ...cookbook]

/** Return one sidebar collection in declared section and page order. */
export function orderedPages(locale: DocsLocale, collection: DocsSidebar): DocsPage[] {
  return docsPages
    .filter(page => page.locale === locale && page.sidebar === collection)
    .sort((left, right) => (
      sectionSpec(locale, left.section).index - sectionSpec(locale, right.section).index
      || left.order - right.order
    ))
}

/** Return the site-relative URL for a published Markdown route. */
export function routeLink(route: string): string {
  return `/${route.replace(/(?:index)?\.md$/, '')}`
}

/** Return the first published page of one navigation collection. */
export function landingLink(locale: DocsLocale, collection: DocsSidebar): string {
  const first = orderedPages(locale, collection)[0]
  if (first === undefined) throw new Error(`Sidebar collection "${collection}" publishes no page.`)
  return routeLink(first.route)
}
