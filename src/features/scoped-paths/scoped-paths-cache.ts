import { WorkspaceFolder } from 'vscode'
import { getParents } from '../../utils/get-parents'
import { unique } from '../../utils/unique'
import { DynamicScopeProvider } from './dynamic-scope-provider'
import { ScopedPathsConfig } from './scoped-paths-config'
import { ScopedPathsWorkspaceState } from './scoped-paths-workspace-state'
import { createScopedUriToPath } from './toolkit/create-scoped-uri-to-path'
import { pathToUri } from '../../utils/path-to-uri'

export class ScopedPathsCache {
  private _cachedCurrentlyScopedAndExcludedPaths: string[] = []
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyExcludedPaths: string[] = []
  private _cachedCurrentlyScopedWorkspaceFolderNames: string[] = []
  private _cachedCurrentlyExcludedWorkspaceFolderNames: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedCurrentlyExcludedPathsSet: Set<string> = new Set()
  private _cachedParentsOfCurrentlyScopedAndExcludedPathsSet: Set<string> = new Set()
  private _cachedContextScopedPaths: string[] = []
  private _cachedContextExcludedPaths: string[] = []

  constructor(
    private readonly config: ScopedPathsConfig,
    private readonly workspaceState: ScopedPathsWorkspaceState,
    private readonly dynamicScopeProviders: DynamicScopeProvider[],
    private readonly getCurrentWorkspaceFoldersSnapshot: () => WorkspaceFolder[],
  ) {
    this.update()
  }

  update() {
    const currentScope = this.workspaceState.getCurrentScope()

    const [dynamicScopeProvider, ...remainingDynamicScopeProviders] = this.dynamicScopeProviders.filter(p => p.isScopeMatching(currentScope))
    if (remainingDynamicScopeProviders.length > 0) {
      console.warn('[ScopedPaths] More than one DynamicScopeProvider is matching the current scope')
    }

    this._cachedCurrentlyScopedAndExcludedPaths = unique(
      dynamicScopeProvider
        ? dynamicScopeProvider.getScopedAndExcludedPaths({
          currentScope,
          uriToPath: createScopedUriToPath(this.getCurrentWorkspaceFoldersSnapshot()),
        })
        : (this.config.getScopesObject()[currentScope] ?? [])
    )

    this._cachedCurrentlyScopedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => !path.startsWith('!'))
    this._cachedCurrentlyExcludedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => path.startsWith('!')).map(path => path.slice(1))

    this._cachedCurrentlyScopedWorkspaceFolderNames = unique(this._cachedCurrentlyScopedPaths.map(path => path.split('/')[0]))
    this._cachedCurrentlyExcludedWorkspaceFolderNames = unique(this._cachedCurrentlyExcludedPaths.filter(path => !path.includes('/')))

    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedCurrentlyExcludedPathsSet = new Set(this._cachedCurrentlyExcludedPaths)
    this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet = new Set(
      [...this._cachedCurrentlyScopedPaths, ...this._cachedCurrentlyExcludedPaths].flatMap(path => getParents(path))
    )

    this._cachedContextScopedPaths = this._cachedCurrentlyScopedPaths.map(scopedPath => pathToUri(scopedPath)?.path).filter(path => path !== undefined)
    this._cachedContextExcludedPaths = this._cachedCurrentlyExcludedPaths.map(excludedPath => pathToUri(excludedPath)?.path).filter(path => path !== undefined)
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

  getCachedCurrentlyScopedWorkspaceFolderNames() {
    return this._cachedCurrentlyScopedWorkspaceFolderNames
  }

  getCachedCurrentlyExcludedWorkspaceFolderNames() {
    return this._cachedCurrentlyExcludedWorkspaceFolderNames
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

  getCachedContextScopedPaths() {
    return this._cachedContextScopedPaths
  }

  getCachedContextExcludedPaths() {
    return this._cachedContextExcludedPaths
  }
}