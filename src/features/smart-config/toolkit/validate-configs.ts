import { window } from 'vscode'
import { Config, Rule } from '../common'
import { Inspected } from '../smart-config-config'
import { unique } from '../../../utils/unique'

export function validateConfigs(
  rules: Rule[],
  configs: Inspected<Record<string, Config>>,
) {
  const usedConfigs = rules.flatMap(rule => rule.apply)
  const availableConfigs = Object.values(configs).filter(Boolean).flatMap(config => Object.keys(config))
  const missingConfigs = unique(usedConfigs.filter(config => !availableConfigs.includes(config)))

  if (missingConfigs.length > 0) {
    console.warn('[SmartConfig] Missing configs:', { missingConfigs })
    window.showWarningMessage(
      `Smart Config: Config${
        missingConfigs.length > 1 ? 's' : ''
      } ${
        missingConfigs.map(config => `"${config}"`).join(', ')
      } ${
        missingConfigs.length > 1 ? 'are' : 'is'
      } not defined in "streamline.smartConfig.configs" configuration section`,
    )
  }
}
