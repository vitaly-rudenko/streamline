import { getConfig, initialConfig } from '../../config'
import { getParents } from '../../utils/get-parents'
import { FeatureConfig } from '../feature-config'
import { QUICK_SCOPE_PREFIX } from './constants'

const defaultEnabled = false
const defaultCurrentScope = 'default'
const defaultHighlightStatusBarWhenEnabled = true

export class ScopedPathsConfig extends FeatureConfig {
  private _enabled: boolean = defaultEnabled
  private _currentScope: string = defaultCurrentScope
  private _scopesObject: Record<string, string[]> = {}
  private _highlightStatusBarWhenEnabled: boolean = defaultHighlightStatusBarWhenEnabled
  private _cachedCurrentlyScopedAndExcludedPaths: string[] = []
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyExcludedPaths: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedCurrentlyExcludedPathsSet: Set<string> = new Set()
  private _cachedParentsOfCurrentlyScopedAndExcludedPathsSet: Set<string> = new Set()

  constructor() {
    super('ScopedPaths')
    this.load(initialConfig)
    this._updateScopedPathsCache()
  }

  load(config = getConfig()) {
    const enabled = config.get<boolean>('scopedPaths.enabled', defaultEnabled)
    const currentScope = config.get<string>('scopedPaths.currentScope', defaultCurrentScope)
    const scopesObject = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
    const highlightStatusBarWhenEnabled = config.get<boolean>('scopedPaths.highlightStatusBarWhenEnabled', defaultHighlightStatusBarWhenEnabled)

    let hasChanged = false

    if (
      this._enabled !== enabled
      || this._currentScope !== currentScope
      || this._highlightStatusBarWhenEnabled !== highlightStatusBarWhenEnabled
      || JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
    ) {
      this._enabled = enabled
      this._currentScope = currentScope
      this._scopesObject = scopesObject
      this._highlightStatusBarWhenEnabled = highlightStatusBarWhenEnabled

      hasChanged = true
    }

    if (hasChanged) {
      this._updateScopedPathsCache()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, enabled, currentScope, scopesObject, highlightStatusBarWhenEnabled })

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
      Object.entries(this._scopesObject)
        .filter(([scope]) => !scope.startsWith(QUICK_SCOPE_PREFIX))
        .some(([scope, scopedPaths]) => scope !== defaultCurrentScope || scopedPaths.length > 0)
          ? this._scopesObject : undefined
    )

    console.debug('[ScopedPaths] Config has been saved')
  }

  private _updateScopedPathsCache() {
    this._cachedCurrentlyScopedAndExcludedPaths = this._currentScope.startsWith(QUICK_SCOPE_PREFIX)
      ? [this._currentScope.slice(QUICK_SCOPE_PREFIX.length)]
      : (this._scopesObject[this._currentScope] ?? [])

    this._cachedCurrentlyScopedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => !path.startsWith('!'))
    this._cachedCurrentlyExcludedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => path.startsWith('!')).map(path => path.slice(1))

    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedCurrentlyExcludedPathsSet = new Set(this._cachedCurrentlyExcludedPaths)
    this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet = new Set(
      [...this._cachedCurrentlyScopedPaths, ...this._cachedCurrentlyExcludedPaths]
        .flatMap(path => getParents(path))
    )
  }

  getDynamicIsInQuickScope() {
    return this._currentScope.startsWith(QUICK_SCOPE_PREFIX)
  }

  getCachedCurrentlyScopedAndExcludedPaths() {
    return this._cachedCurrentlyScopedAndExcludedPaths
  }

  getCachedCurrentlyScopedPaths() {
    return this._cachedCurrentlyScopedPaths
  }

  getCachedCurrentlyExcludedPaths() {
    return this._cachedCurrentlyExcludedPaths
  }

  getCachedCurrentlyScopedPathsSet() {
    return this._cachedCurrentlyScopedPathsSet
  }

  getCachedCurrentlyExcludedPathsSet() {
    return this._cachedCurrentlyExcludedPathsSet
  }

  getCachedParentsOfCurrentlyScopedAndExcludedPathsSet() {
    return this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet
  }

  setEnabled(value: boolean) {
    this._enabled = value
  }

  getEnabled() {
    return this._enabled
  }

  getHighlightStatusBarWhenEnabled() {
    return this._highlightStatusBarWhenEnabled
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