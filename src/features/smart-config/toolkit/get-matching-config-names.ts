import { basename } from 'path'
import { Rule, Condition, SmartConfigContext } from '../common'

// TODO: Add support for glob

/** Matches rules against the provided context, at least one condition must match per rule */
export function getMatchingConfigNames(ctx: SmartConfigContext, rules: Rule[]): string[] {
  const configNames: string[] = []

  for (const rule of rules) {
    if (rule.when.some(condition => testCondition(ctx, condition))) {
      configNames.push(...rule.apply)
    }
  }

  return configNames
}

/** Match specific condition against the provided context */
function testCondition(ctx: SmartConfigContext, condition: Condition): boolean {
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
