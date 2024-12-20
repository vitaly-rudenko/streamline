export type Config = Record<string, unknown>

export type ColorThemeKindSlug = 'dark' | 'light' | 'high-contrast' | 'high-contrast-light'

export type Condition =
 | { basename: string }
 | { path: string }
 | { toggle: string }
 | { colorThemeKind: ColorThemeKindSlug }
 | { languageId: string }
 | {
    scope: string
    enabled?: boolean | undefined
  }

export type Rule = {
  apply: string[]
  when: Condition[]
}

export type SmartConfigContext = {
  languageId?: string | undefined
  path?: string | undefined
  toggles: string[]
  colorThemeKind: ColorThemeKindSlug
  scope?: string | undefined
  scopeEnabled: boolean
}
