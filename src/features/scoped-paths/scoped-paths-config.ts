import { Uri, type WorkspaceFolder } from 'vscode'
import { getConfig, initialConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { getParents } from '../../utils/get-parents'
import { FeatureConfig } from '../feature-config'

const defaultEnabled = false
const defaultCurrentScope = 'default'
const defaultHideWorkspaceFolders = false

type SerializedWorkspaceFolder = {
  name: string;
  uri: string;
  index: number;
}

export class ScopedPathsConfig extends FeatureConfig {
  private _enabled: boolean = defaultEnabled
  private _currentScope: string = defaultCurrentScope
  private _scopesObject: Record<string, string[]> = {}
  private _workspaceFoldersBackup: WorkspaceFolder[] = []
  private _hideWorkspaceFolders: boolean = defaultHideWorkspaceFolders
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedCurrentlyScopedWorkspaceFolderNamesSet: Set<string> = new Set()
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
    const workspaceFoldersBackup = config.get<SerializedWorkspaceFolder[]>('scopedPaths.workspaceFoldersBackup', [])
      .map(wf => ({ ...wf, uri: Uri.parse(wf.uri) }))
    const hideWorkspaceFolders = config.get<boolean>('scopedPaths.hideWorkspaceFolders', defaultHideWorkspaceFolders)

    let hasChanged = false

    if (
      this._enabled !== enabled
      || this._currentScope !== currentScope
      || JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
      || !areArraysShallowEqual(this._workspaceFoldersBackup, workspaceFoldersBackup)
      || this._hideWorkspaceFolders !== hideWorkspaceFolders
    ) {
      this._enabled = enabled
      this._currentScope = currentScope
      this._scopesObject = scopesObject
      this._workspaceFoldersBackup = workspaceFoldersBackup
      this._hideWorkspaceFolders = hideWorkspaceFolders

      hasChanged = true
    }

    if (hasChanged) {
      this._updateScopedPathsCache()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, enabled, currentScope, scopesObject, workspaceFoldersBackup, hideWorkspaceFolders })

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

    await config.update(
      'scopedPaths.workspaceFoldersBackup',
      this._workspaceFoldersBackup.length > 0
        ? this._workspaceFoldersBackup.map(wf => ({ ...wf, uri: wf.uri.toString() }))
        : undefined
    )

    console.debug('[ScopedPaths] Config has been saved')
  }

  private _updateScopedPathsCache() {
    this._cachedCurrentlyScopedPaths = this._scopesObject[this._currentScope] ?? []
    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedCurrentlyScopedWorkspaceFolderNamesSet = new Set(this._cachedCurrentlyScopedPaths.map(scopedPath => scopedPath.split('/')[0]))
    this._cachedParentsOfCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths.flatMap(path => getParents(path)))
  }

  getCachedCurrentlyScopedPaths() {
    return this._cachedCurrentlyScopedPaths
  }

  getCachedCurrentlyScopedPathsSet() {
    return this._cachedCurrentlyScopedPathsSet
  }

  getCachedCurrentlyScopedWorkspaceFolderNamesSet() {
    return this._cachedCurrentlyScopedWorkspaceFolderNamesSet
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

  getHideWorkspaceFolders() {
    return this._hideWorkspaceFolders
  }

  setWorkspaceFoldersBackup(value: WorkspaceFolder[]) {
    this._workspaceFoldersBackup = value
  }

  getWorkspaceFoldersBackup() {
    return this._workspaceFoldersBackup
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