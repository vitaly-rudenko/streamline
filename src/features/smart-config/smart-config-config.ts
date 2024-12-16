import { getConfig, initialConfig } from '../../config'
import { FeatureConfig } from '../feature-config'

export type Config = Record<string, unknown>
export type Condition = { basename: string } | { path: string } | { toggle: string }
export type Rule = {
  apply: string[]
  when: Condition[]
}
export type Inspected<T> = {
  globalValue?: T
  workspaceValue?: T
  workspaceFolderValue?: T
}

// TODO: add cache

export class SmartConfigConfig extends FeatureConfig {
  private _inspectedDefaults: Inspected<Config> | undefined
  private _inspectedConfigs: Inspected<Record<string, Config>> | undefined
  private _inspectedToggles: Inspected<string[]> | undefined
  private _inspectedRules: Inspected<Rule[]> | undefined

  constructor() {
    super('SmartConfig')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const inspectedDefaults = config.inspect<Config>('smartConfig.defaults')
    const inspectedConfigs = config.inspect<Record<string, Config>>('smartConfig.configs')
    const inspectedToggles = config.inspect<string[]>('smartConfig.toggles')
    const inspectedRules = config.inspect<Rule[]>('smartConfig.rules')

    this._inspectedDefaults = inspectedDefaults
    this._inspectedConfigs = inspectedConfigs
    this._inspectedToggles = inspectedToggles
    this._inspectedRules = inspectedRules

    // TODO: implement hasChanged

    console.debug('[SmartConfig] Config has been loaded', {
      inspectedDefaults,
      inspectedConfigs,
      inspectedToggles,
      inspectedRules,
    })

    return true
  }

  async save() {}

  getInspectedDefaults() {
    return this._inspectedDefaults
  }

  getInspectedConfigs() {
    return this._inspectedConfigs
  }

  getInspectedToggles() {
    return this._inspectedToggles
  }

  getInspectedRules() {
    return this._inspectedRules
  }
}
