import { Rule } from '../common'
import { ConditionContext, testWhen } from '../../../common/when'

// TODO: Add support for glob

/** Matches rules against the provided context, at least one condition must match per rule */
export function getMatchingConfigNames(ctx: ConditionContext, rules: Rule[]): string[] {
  const configNames: string[] = []

  for (const rule of rules) {
    if (testWhen(ctx, rule.when)) {
      configNames.push(...rule.apply)
    }
  }

  return configNames
}


