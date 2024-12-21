export type Config = Record<string, unknown>

type ColorThemeKindSlug = 'dark' | 'light' | 'high-contrast' | 'high-contrast-light'

export type Condition =
 | { basename: string }
 | { path: string }
 | { toggle: string }
 | { colorThemeKind: ColorThemeKindSlug }
 | { languageId: string }
 | { scopeSelected: string }
 | { scopeEnabled: boolean }
 | { scope: string } // Shorthand for { scopeSelected: 'scope' } && { scopeEnabled: true }

export type Rule = {
  apply: string[]
  when: Condition[]
}

export type SmartConfigContext = {
  languageId?: string | undefined
  path?: string | undefined
  toggles: string[]
  colorThemeKind: ColorThemeKindSlug
  scopeSelected?: string | undefined
  scopeEnabled: boolean
}
