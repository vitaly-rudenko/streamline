import { basename } from 'path'
import z from 'zod'

const colorThemeKindSlugSchema = z.enum(['dark', 'light', 'high-contrast', 'high-contrast-light'])
type ColorThemeKindSlug = z.infer<typeof colorThemeKindSlugSchema>

export const conditionSchema = z.union([
  z.object({ basename: z.string() }),
  z.object({ path: z.string() }),
  z.object({ toggle: z.string() }),
  z.object({ colorThemeKind: colorThemeKindSlugSchema }),
  z.object({ languageId: z.string() }),
  z.object({ scopeSelected: z.string() }),
  z.object({ scopeEnabled: z.boolean() }),
  z.object({ scope: z.string() }), // Shorthand for { scopeSelected: 'scope' } && { scopeEnabled: true }
])

export type Condition = z.infer<typeof conditionSchema>

export const whenSchema = z.array(conditionSchema)
export type When = z.infer<typeof whenSchema>

export type ConditionContext = {
  languageId?: string | undefined
  path?: string | undefined
  toggles: string[]
  colorThemeKind: ColorThemeKindSlug
  scopeSelected?: string | undefined
  scopeEnabled: boolean
}

export function testWhen(ctx: ConditionContext, when: When): boolean {
  return when.some(condition => testCondition(ctx, condition))
}

/** Match specific condition against the provided context */
function testCondition(ctx: ConditionContext, condition: Condition): boolean {
  if (ctx.path) {
    if ('path' in condition) {
      return new RegExp(condition.path).test(ctx.path)
    }

    if ('basename' in condition) {
      return new RegExp(condition.basename).test(basename(ctx.path))
    }
  }

  if ('toggle' in condition) {
    return ctx.toggles.includes(condition.toggle)
  }

  if ('colorThemeKind' in condition) {
    return ctx.colorThemeKind === condition.colorThemeKind
  }

  if ('languageId' in condition) {
    return ctx.languageId === condition.languageId
  }

  if ('scope' in condition) {
    return ctx.scopeSelected === condition.scope && ctx.scopeEnabled
  }

  if ('scopeSelected' in condition) {
    return ctx.scopeSelected === condition.scopeSelected
  }

  if ('scopeEnabled' in condition) {
    return ctx.scopeEnabled === condition.scopeEnabled
  }

  return false
}
