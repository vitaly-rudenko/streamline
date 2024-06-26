import { getConfig, initialConfig } from '../../config'
import { getParents } from '../../utils/get-parents'
import { FeatureConfig } from '../feature-config'

const defaultEnabled = false
const defaultCurrentScope = 'default'

export class ScopedPathsConfig extends FeatureConfig {
  private _enabled: boolean = defaultEnabled
  private _currentScope: string = defaultCurrentScope
  private _scopesObject: Record<string, string[]> = {}
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedParentsOfCurrentlyScopedPathsSet: Set<string> = new Set()

  constructor() {
    super('ScopedPaths')
    this.load(initialConfig)
    this._updateScopedPathsCache()
  }

  load(config = getConfig()) {
    const enabled = config.get<boolean>('scopedPaths.enabled', defaultEnabled)
    const currentScope = config.get<string>('scopedPaths.currentScope', defaultCurrentScope)
    const scopesObject = config.get<Record<string, string[]>>('scopedPaths.scopes', {})

    let hasChanged = false

    if (
      this._enabled !== enabled
      || this._currentScope !== currentScope
      || JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
    ) {
      this._enabled = enabled
      this._currentScope = currentScope
      this._scopesObject = scopesObject

      hasChanged = true
    }

    if (hasChanged) {
      this._updateScopedPathsCache()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, enabled, currentScope, scopesObject })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'scopedPaths.enabled',
      this._enabled !== defaultEnabled ? this._enabled : undefined
    )

    await config.update(
      'scopedPaths.currentScope',
      this._currentScope !== defaultCurrentScope ? this._currentScope : undefined
    )

    await config.update(
      'scopedPaths.scopes',
      Object.entries(this._scopesObject).some(([scope, scopedPaths]) => scope !== defaultCurrentScope || scopedPaths.length > 0)
        ? this._scopesObject : undefined
    )

    console.debug('[ScopedPaths] Config has been saved')
  }

  private _updateScopedPathsCache() {
    this._cachedCurrentlyScopedPaths = this._scopesObject[this._currentScope] ?? []
    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedParentsOfCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths.flatMap(path => getParents(path)))
  }

  getCachedCurrentlyScopedPaths() {
    return this._cachedCurrentlyScopedPaths
  }

  getCachedCurrentlyScopedPathsSet() {
    return this._cachedCurrentlyScopedPathsSet
  }

  getCachedParentsOfCurrentlyScopedPathsSet() {
    return this._cachedParentsOfCurrentlyScopedPathsSet
  }

  setEnabled(value: boolean) {
    this._enabled = value
  }

  getEnabled() {
    return this._enabled
  }

  setCurrentScope(value: string) {
    this._currentScope = value
    this._updateScopedPathsCache()
  }

  getCurrentScope() {
    return this._currentScope
  }

  setScopesObject(value: Record<string, string[]>) {
    this._scopesObject = value
    this._updateScopedPathsCache()
  }

  getScopesObject() {
    return this._scopesObject
  }
}