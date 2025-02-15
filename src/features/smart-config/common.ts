import z from 'zod'

export type Config = Record<string, unknown>

const colorThemeKindSlugSchema = z.enum(['dark', 'light', 'high-contrast', 'high-contrast-light'])
type ColorThemeKindSlug = z.infer<typeof colorThemeKindSlugSchema>

export type Condition =
 | { basename: string }
 | { path: string }
 | { toggle: string }
 | { colorThemeKind: ColorThemeKindSlug }
 | { languageId: string }
 | { scopeSelected: string }
 | { scopeEnabled: boolean }
 | { scope: string } // Shorthand for { scopeSelected: 'scope' } && { scopeEnabled: true }

export const ruleSchema = z.object({
  apply: z.array(z.string()),
  when: z.array(
    z.union([
      z.object({ basename: z.string() }),
      z.object({ path: z.string() }),
      z.object({ toggle: z.string() }),
      z.object({ colorThemeKind: colorThemeKindSlugSchema }),
      z.object({ languageId: z.string() }),
      z.object({ scopeSelected: z.string() }),
      z.object({ scopeEnabled: z.boolean() }),
      z.object({ scope: z.string() }),
    ])
  )
})

export type Rule = z.infer<typeof ruleSchema>

export type SmartConfigContext = {
  languageId?: string | undefined
  path?: string | undefined
  toggles: string[]
  colorThemeKind: ColorThemeKindSlug
  scopeSelected?: string | undefined
  scopeEnabled: boolean
}
