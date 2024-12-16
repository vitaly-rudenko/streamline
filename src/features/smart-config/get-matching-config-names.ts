import { basename } from 'path'
import { Condition, Rule } from './smart-config-config'

export type SmartConfigContext = {
  path: string | undefined
  toggles: string[]
}

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

  return false
}
