import { basename } from 'path'
import z, { ZodType } from 'zod'

const colorThemeKindSlugSchema = z.enum(['dark', 'light', 'high-contrast', 'high-contrast-light'])
type ColorThemeKindSlug = z.infer<typeof colorThemeKindSlugSchema>

function createConditionField<T extends ZodType>(type: T) {
  return z.union([type, z.array(type)]).optional()
}

const basicConditionSchema = z.strictObject({
  untitled: createConditionField(z.boolean()),
  basename: createConditionField(z.string()),
  path: createConditionField(z.string()),
  toggle: createConditionField(z.string()),
  colorThemeKind: createConditionField(colorThemeKindSlugSchema),
  // https://code.visualstudio.com/docs/languages/identifiers
  languageId: createConditionField(z.string()),
  scopeSelected: createConditionField(z.string()),
  scopeEnabled: createConditionField(z.boolean()),
  scope: createConditionField(z.string()), // Shorthand for [{ scopeSelected: 'scope', scopeEnabled: true }]
  fileType: createConditionField(z.enum(['file', 'directory'])),
  selection: createConditionField(z.boolean()),
  hasVisibleFoldedRegions: createConditionField(z.boolean()),
  hasBreakpoints: createConditionField(z.boolean()),
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
  hasVisibleFoldedRegions?: boolean | undefined
  hasBreakpoints?: boolean | undefined
}

export function testWhen(ctx: ConditionContext, when: When, options?: { supportedToggles?: string[] }): boolean {
  return when.length === 0 || when.some(condition => testCondition(ctx, condition, options))
}

// TODO: Add support for glob patterns instead of regex
/** Match specific condition against the provided context */
function testCondition(ctx: ConditionContext, condition: Condition, options?: { supportedToggles?: string[] }): boolean {
  const checks: boolean[] = []

  if (condition.path !== undefined) {
    checks.push(ctx.path !== undefined && toArray(condition.path).some(i => new RegExp(i).test(ctx.path!)))
  }

  if (condition.basename !== undefined) {
    checks.push(ctx.path !== undefined && toArray(condition.basename).some(i => new RegExp(i).test(basename(ctx.path!))))
  }

  if (condition.untitled !== undefined) {
    checks.push(ctx.untitled !== undefined && toArray(condition.untitled).some(i => i === ctx.untitled))
  }

  if (condition.toggle !== undefined) {
    const toggles = toArray(condition.toggle)

    const supportedToggles = options?.supportedToggles
    if (supportedToggles) {
      const unsupportedToggles = toggles.filter(toggle => !supportedToggles.includes(toggle))
      if (unsupportedToggles.length > 0) {
        throw new UnsupportedTogglesError(unsupportedToggles)
      }
    }

    checks.push(toggles.some(i => ctx.toggles.includes(i)))
  }

  if (condition.colorThemeKind !== undefined) {
    checks.push(toArray(condition.colorThemeKind).some(i => i === ctx.colorThemeKind))
  }

  if (condition.languageId !== undefined) {
    checks.push(toArray(condition.languageId).some(i => i === ctx.languageId))
  }

  if (condition.scope !== undefined) {
    checks.push(ctx.scopeEnabled && toArray(condition.scope).some(i => i === ctx.scopeSelected))
  }

  if (condition.scopeSelected !== undefined) {
    checks.push(toArray(condition.scopeSelected).some(i => i === ctx.scopeSelected))
  }

  if (condition.scopeEnabled !== undefined) {
    checks.push(toArray(condition.scopeEnabled).some(i => i === ctx.scopeEnabled))
  }

  if (condition.fileType !== undefined) {
    checks.push(toArray(condition.fileType).some(i => i === ctx.fileType))
  }

  if (condition.selection !== undefined) {
    checks.push(toArray(condition.selection).some(i => i === ctx.selection))
  }

  if (condition.hasVisibleFoldedRegions !== undefined) {
    checks.push(toArray(condition.hasVisibleFoldedRegions).some(i => i === ctx.hasVisibleFoldedRegions))
  }

  if (condition.hasBreakpoints !== undefined) {
    checks.push(toArray(condition.hasBreakpoints).some(i => i === ctx.hasBreakpoints))
  }

  if (condition.not !== undefined) {
    checks.push(!testCondition(ctx, condition.not, options))
  }

  return checks.length > 0 && checks.every(check => check === true)
}

function toArray<T>(item: T | T[]): T[] {
  return Array.isArray(item) ? item : [item]
}

export class UnsupportedTogglesError extends Error {
  constructor(public readonly toggles: string[]) {
    super(`Toggle${
      toggles.length > 1 ? 's' : ''
    } ${
      toggles.map(toggle => `"${toggle}"`).join(', ')
    } ${
      toggles.length > 1 ? 'are' : 'is'
    } not defined in "streamline.smartConfig.toggles" configuration section`)
  }
}
