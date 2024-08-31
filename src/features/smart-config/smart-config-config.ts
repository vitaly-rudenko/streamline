import { getConfig, initialConfig } from '../../config'
import { FeatureConfig } from '../feature-config'

type Config = Record<string, unknown>
type PatternsObject = Record<string, Config>
type InspectedPatternsObject = {
  globalValue?: PatternsObject
  workspaceValue?: PatternsObject
  workspaceFolderValue?: PatternsObject
}

export type ConfigurationTargetPatterns = {
  defaultConfig?: Config
  patterns: [RegExp, Config][]
}

const defaultPattern = 'default'

export class SmartConfigConfig extends FeatureConfig {
  private _inspectedPatternsObject: InspectedPatternsObject | undefined
  private _cachedGlobalPatterns: ConfigurationTargetPatterns | undefined
  private _cachedWorkspacePatterns: ConfigurationTargetPatterns | undefined
  private _cachedWorkspaceFolderPatterns: ConfigurationTargetPatterns | undefined

  constructor() {
    super('SmartConfig')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const inspectedPatternsObject = config.inspect<PatternsObject>('smartConfig.patterns')

    let hasChanged = false

    if (JSON.stringify(this._inspectedPatternsObject) !== JSON.stringify(inspectedPatternsObject)) {
      this._inspectedPatternsObject = inspectedPatternsObject
      this._updatePatternsCache()
      hasChanged = true
    }

    console.debug('[SmartConfig] Config has been loaded', { hasChanged, inspectedPatternsObject })

    return hasChanged
  }

  async save() {}

  _updatePatternsCache() {
    this._cachedGlobalPatterns = parsePatternsObject(this._inspectedPatternsObject?.globalValue)
    this._cachedWorkspacePatterns = parsePatternsObject(this._inspectedPatternsObject?.workspaceValue)
    this._cachedWorkspaceFolderPatterns = parsePatternsObject(this._inspectedPatternsObject?.workspaceFolderValue)
  }

  getCachedGlobalPatterns() {
    return this._cachedGlobalPatterns
  }

  getCachedWorkspacePatterns() {
    return this._cachedWorkspacePatterns
  }

  getCachedWorkspaceFolderPatterns() {
    return this._cachedWorkspaceFolderPatterns
  }
}

function parsePatternsObject(patternsObject: PatternsObject | undefined): ConfigurationTargetPatterns | undefined {
  if (!patternsObject || Object.keys(patternsObject).length === 0) {
    return undefined
  }

  return {
    defaultConfig: patternsObject[defaultPattern],
    patterns: Object.entries(patternsObject)
      .filter(([pattern]) => pattern !== defaultPattern)
      .map(([pattern, config]) => [new RegExp(pattern), config] as const)
  }
}
