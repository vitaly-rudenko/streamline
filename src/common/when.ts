import { basename } from 'path'
import z from 'zod'

const colorThemeKindSlugSchema = z.enum(['dark', 'light', 'high-contrast', 'high-contrast-light'])
type ColorThemeKindSlug = z.infer<typeof colorThemeKindSlugSchema>

export const conditionSchema = z.strictObject({
  untitled: z.boolean().optional(),
  basename: z.string().optional(),
  path: z.string().optional(),
  toggle: z.string().optional(),
  colorThemeKind: colorThemeKindSlugSchema.optional(),
  // https://code.visualstudio.com/docs/languages/identifiers
  languageId: z.string().optional(),
  scopeSelected: z.string().optional(),
  scopeEnabled: z.boolean().optional(),
  scope: z.string().optional(), // Shorthand for [{ scopeSelected: 'scope', scopeEnabled: true }]
  fileType: z.enum(['file', 'directory']).optional(),
  selection: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0,  'At least one condition must be present')

export type Condition = z.infer<typeof conditionSchema>

// [Condition1, Condition2, ...] => Condition1 || Condition2 || ...
// [[Condition1, Condition2], [Condition3, Condition4], ...] => (Condition1 && Condition2) || (Condition3 && Condition4) || ...
export const whenSchema = z.array(z.union([conditionSchema, z.array(conditionSchema)]))
export type When = z.infer<typeof whenSchema>

export type ConditionContext = {
  languageId?: string | undefined
  path?: string | undefined
  toggles: string[]
  colorThemeKind: ColorThemeKindSlug
  scopeSelected?: string | undefined
  scopeEnabled: boolean
  untitled?: boolean | undefined
  fileType?: 'file' | 'directory' | undefined
  selection?: boolean | undefined
}

export function testWhen(ctx: ConditionContext, when: When): boolean {
  if (when.length === 0) return true
  return when.some(condition => (
    Array.isArray(condition)
      ? condition.every(subCondition => testCondition(ctx, subCondition))
      : testCondition(ctx, condition)
  ))
}
/** Match specific condition against the provided context */
function testCondition(ctx: ConditionContext, condition: Condition): boolean {
  if (ctx.path !== undefined) {
    if (condition.path !== undefined) {
      return new RegExp(condition.path).test(ctx.path)
    }

    if (condition.basename !== undefined) {
      return new RegExp(condition.basename).test(basename(ctx.path))
    }
  }

  if (ctx.untitled !== undefined) {
    if (condition.untitled !== undefined) {
      return condition.untitled === ctx.untitled
    }
  }

  if (condition.toggle !== undefined) {
    return ctx.toggles.includes(condition.toggle)
  }

  if (condition.colorThemeKind !== undefined) {
    return ctx.colorThemeKind === condition.colorThemeKind
  }

  if (condition.languageId !== undefined) {
    return ctx.languageId === condition.languageId
  }

  if (condition.scope !== undefined) {
    return ctx.scopeSelected === condition.scope && ctx.scopeEnabled
  }

  if (condition.scopeSelected !== undefined) {
    return ctx.scopeSelected === condition.scopeSelected
  }

  if (condition.scopeEnabled !== undefined) {
    return ctx.scopeEnabled === condition.scopeEnabled
  }

  if (condition.fileType !== undefined) {
    return ctx.fileType === condition.fileType
  }

  if (condition.selection !== undefined) {
    return ctx.selection === condition.selection
  }

  return false
}
