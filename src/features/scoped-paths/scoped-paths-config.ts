import { getConfig } from '../../config'
import { getParents } from '../../utils/get-parents'

export class ScopedPathsConfig {
  private _enabled: boolean = false
  private _currentScope: string = 'default'
  private _scopesObject: Record<string, string[]> = {}
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedParentsOfCurrentlyScopedPathsSet: Set<string> = new Set()

  load(): boolean {
    const config = getConfig()
    const enabled = config.get<boolean>('scopedPaths.enabled', false)
    const currentScope = config.get<string>('scopedPaths.currentScope', 'default')
    const scopesObject = config.get<Record<string, string[]>>('scopedPaths.scopes', {})

    let hasChanged = false

    if (this._enabled !== enabled) {
      this._enabled = enabled

      hasChanged = true
    }

    if (
      this._currentScope !== currentScope ||
      JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
    ) {
      this._currentScope = currentScope
      this._scopesObject = scopesObject
      this._updateScopedPathsCache()

      hasChanged = true
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged })

    return hasChanged
  }

  async save() {
    const config = getConfig()
    await config.update('scopedPaths.enabled', this._enabled)
    await config.update('scopedPaths.currentScope', this._currentScope)
    await config.update('scopedPaths.scopes', this._scopesObject)

    console.debug('[ScopedPaths] Config has been saved')
  }

  private _updateScopedPathsCache() {
    this._cachedCurrentlyScopedPaths = this._scopesObject[this._currentScope] ?? []
    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedParentsOfCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths.flatMap(path => getParents(path)))
  }

  get cachedCurrentlyScopedPaths() {
    return this._cachedCurrentlyScopedPaths
  }

  get cachedCurrentlyScopedPathsSet() {
    return this._cachedCurrentlyScopedPathsSet
  }

  get cachedParentsOfCurrentlyScopedPathsSet() {
    return this._cachedParentsOfCurrentlyScopedPathsSet
  }

  set enabled(value: boolean) {
    this._enabled = value
  }

  get enabled() {
    return this._enabled
  }

  set currentScope(value: string) {
    this._currentScope = value
    this._updateScopedPathsCache()
  }

  get currentScope() {
    return this._currentScope
  }

  set scopesObject(value: Record<string, string[]>) {
    this._scopesObject = value
    this._updateScopedPathsCache()
  }

  get scopesObject() {
    return this._scopesObject
  }
}