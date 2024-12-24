import z from 'zod'
import { getConfig, initialConfig, safeConfigInspect } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { unique } from '../../utils/unique'
import { FeatureConfig } from '../feature-config'
import { Config, Rule, ruleSchema } from './common'

type Inspected<T> = {
  globalValue?: T
  workspaceValue?: T
  workspaceFolderValue?: T
}

export class SmartConfigConfig extends FeatureConfig {
  private _inspectedDefaults: Inspected<Config> = {}
  private _inspectedConfigs: Inspected<Record<string, Config>> = {}
  private _mergedToggles: string[] = []
  private _mergedRules: Rule[] = []

  constructor() {
    super('SmartConfig')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const inspectedDefaults = safeConfigInspect(config, 'smartConfig.defaults', z.record(z.unknown()))
    const inspectedConfigs = safeConfigInspect(config, 'smartConfig.configs', z.record(z.string(), z.record(z.unknown())))
    const inspectedToggles = safeConfigInspect(config, 'smartConfig.toggles', z.array(z.string()))
    const inspectedRules = safeConfigInspect(config, 'smartConfig.rules', z.array(ruleSchema))

    // Arrays are overridden by VS Code, so we merge them instead
    const mergedToggles: string[] = unique([
      ...inspectedToggles?.globalValue ?? [],
      ...inspectedToggles?.workspaceValue ?? [],
      ...inspectedToggles?.workspaceFolderValue ?? [],
    ])

    // Arrays are overridden by VS Code, so we merge them instead
    const mergedRules: Rule[] = [
      ...inspectedRules?.globalValue ?? [],
      ...inspectedRules?.workspaceValue ?? [],
      ...inspectedRules?.workspaceFolderValue ?? [],
    ]

    let hasChanged = false

    if (
      !areArraysShallowEqual(this._mergedToggles, mergedToggles)
      || JSON.stringify(this._inspectedDefaults) !== JSON.stringify(inspectedDefaults)
      || JSON.stringify(this._inspectedConfigs) !== JSON.stringify(inspectedConfigs)
      || JSON.stringify(this._mergedRules) !== JSON.stringify(mergedRules)
    ) {
      this._inspectedDefaults = inspectedDefaults ?? {}
      this._inspectedConfigs = inspectedConfigs ?? {}
      this._mergedToggles = mergedToggles
      this._mergedRules = mergedRules

      hasChanged = true
    }

    console.debug('[SmartConfig] Config has been loaded', { hasChanged, inspectedDefaults, inspectedConfigs, mergedToggles, mergedRules })

    return hasChanged
  }

  async save() {}

  getInspectedDefaults() {
    return this._inspectedDefaults
  }

  getInspectedConfigs() {
    return this._inspectedConfigs
  }

  getMergedToggles() {
    return this._mergedToggles
  }

  getMergedRules() {
    return this._mergedRules
  }
}
