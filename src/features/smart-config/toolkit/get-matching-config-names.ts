import { basename } from 'path'
import { Rule, Condition, SmartConfigContext } from '../common'

export function getMatchingConfigNames(context: SmartConfigContext, rules: Rule[]): string[] {
  const configNames: string[] = []

  for (const rule of rules) {
    if (rule.when.some(condition => testCondition(context, condition))) {
      configNames.push(...rule.apply)
    }
  }

  return configNames
}

function testCondition(context: SmartConfigContext, condition: Condition): boolean {
  if (context.path) {
    if ('path' in condition) {
      return new RegExp(condition.path).test(context.path)
    }

    if ('basename' in condition) {
      return new RegExp(condition.basename).test(basename(context.path))
    }
  }

  if ('toggle' in condition) {
    return context.toggles.includes(condition.toggle)
  }

  if ('colorThemeKind' in condition) {
    return context.colorThemeKind === condition.colorThemeKind
  }

  if (context.languageId) {
    if ('languageId' in condition) {
      return context.languageId === condition.languageId
    }
  }

  return false
}
