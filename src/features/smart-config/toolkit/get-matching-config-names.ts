import { Rule } from '../common'
import { ConditionContext, testWhen } from '../../../common/when'

/** Matches rules against the provided context, at least one condition must match per rule */
export function getMatchingConfigNames(ctx: ConditionContext, rules: Rule[], supportedToggles: string[]): string[] {
  const configNames: string[] = []

  for (const rule of rules) {
    if (testWhen(ctx, rule.when, { supportedToggles })) {
      configNames.push(...rule.apply)
    }
  }

  return configNames
}


