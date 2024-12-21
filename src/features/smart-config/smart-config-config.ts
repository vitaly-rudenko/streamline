import { getConfig, initialConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { unique } from '../../utils/unique'
import { FeatureConfig } from '../feature-config'
import { Config, Rule } from './common'

// TODO: add cache

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
    const inspectedDefaults = config.inspect<Config>('smartConfig.defaults')
    const inspectedConfigs = config.inspect<Record<string, Config>>('smartConfig.configs')
    const inspectedToggles = config.inspect<string[]>('smartConfig.toggles')
    const inspectedRules = config.inspect<Rule[]>('smartConfig.rules')

    // Arrays are overridden by VS Code, so we merge them instead
    const mergedToggles: string[] = unique([
      ...inspectedToggles?.defaultValue ?? [],
      ...inspectedToggles?.globalValue ?? [],
      ...inspectedToggles?.workspaceValue ?? [],
      ...inspectedToggles?.workspaceFolderValue ?? [],
    ])

    // Arrays are overridden by VS Code, so we merge them instead
    const mergedRules: Rule[] = [
      ...inspectedRules?.defaultValue ?? [],
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
