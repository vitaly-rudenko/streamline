import { basename } from 'path'
import z from 'zod'

const colorThemeKindSlugSchema = z.enum(['dark', 'light', 'high-contrast', 'high-contrast-light'])
type ColorThemeKindSlug = z.infer<typeof colorThemeKindSlugSchema>

const basicConditionSchema = z.strictObject({
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

export const conditionSchema = basicConditionSchema.and(
  z.object({
    not: basicConditionSchema.optional(),
  })
)

export type Condition = z.infer<typeof conditionSchema>

// [{ Condition1 }, { Condition2, Condition3 }, ...] => Condition1 || (Condition2 && Condition3) || ...
export const whenSchema = z.array(conditionSchema)
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
  return when.length === 0 || when.some(condition => testCondition(ctx, condition))
}

/** Match specific condition against the provided context */
function testCondition(ctx: ConditionContext, condition: Condition): boolean {
  const checks: boolean[] = []

  if (condition.path !== undefined) {
    checks.push(ctx.path !== undefined && new RegExp(condition.path).test(ctx.path))
  }

  if (condition.basename !== undefined) {
    checks.push(ctx.path !== undefined && new RegExp(condition.basename).test(basename(ctx.path)))
  }

  if (condition.untitled !== undefined) {
    checks.push(ctx.untitled !== undefined && condition.untitled === ctx.untitled)
  }

  if (condition.toggle !== undefined) {
    checks.push(ctx.toggles.includes(condition.toggle))
  }

  if (condition.colorThemeKind !== undefined) {
    checks.push(ctx.colorThemeKind === condition.colorThemeKind)
  }

  if (condition.languageId !== undefined) {
    checks.push(ctx.languageId === condition.languageId)
  }

  if (condition.scope !== undefined) {
    checks.push(ctx.scopeSelected === condition.scope && ctx.scopeEnabled)
  }

  if (condition.scopeSelected !== undefined) {
    checks.push(ctx.scopeSelected === condition.scopeSelected)
  }

  if (condition.scopeEnabled !== undefined) {
    checks.push(ctx.scopeEnabled === condition.scopeEnabled)
  }

  if (condition.fileType !== undefined) {
    checks.push(ctx.fileType === condition.fileType)
  }

  if (condition.selection !== undefined) {
    checks.push(ctx.selection === condition.selection)
  }

  if (condition.not !== undefined) {
    checks.push(!testCondition(ctx, condition.not))
  }

  return checks.length > 0 && checks.every(check => check === true)
}
