import { WorkspaceFolder } from 'vscode'
import { getParents } from '../../utils/get-parents'
import { unique } from '../../utils/unique'
import { DynamicScopeProvider } from './dynamic-scope-provider'
import { ScopedPathsConfig } from './scoped-paths-config'
import { ScopedPathsWorkspaceState } from './scoped-paths-workspace-state'

export class ScopedPathsCache {
  private _cachedCurrentlyScopedAndExcludedPaths: string[] = []
  private _cachedCurrentlyScopedPaths: string[] = []
  private _cachedCurrentlyExcludedPaths: string[] = []
  private _cachedCurrentlyScopedWorkspaceFolderNames: string[] = []
  private _cachedCurrentlyScopedPathsSet: Set<string> = new Set()
  private _cachedCurrentlyExcludedPathsSet: Set<string> = new Set()
  private _cachedParentsOfCurrentlyScopedAndExcludedPathsSet: Set<string> = new Set()

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

    const currentWorkspaceFolders = this.getCurrentWorkspaceFoldersSnapshot()
    this._cachedCurrentlyScopedAndExcludedPaths = unique(
      dynamicScopeProvider
        ? dynamicScopeProvider.getScopedAndExcludedPaths({
          currentScope,
          // TODO: Extract & add tests
          uriToPath: (uri) => {
            const exactWorkspaceFolder = currentWorkspaceFolders.find(wf => wf.uri.path === uri.path)
            if (exactWorkspaceFolder) return exactWorkspaceFolder.name

            const workspaceFolder = currentWorkspaceFolders.find(wf => uri.path.startsWith(wf.uri.path + '/'))
            if (!workspaceFolder) return undefined

            return workspaceFolder.name + uri.path.slice(workspaceFolder.uri.path.length)
          }
        })
        : (this.config.getScopesObject()[currentScope] ?? [])
    )

    this._cachedCurrentlyScopedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => !path.startsWith('!'))
    this._cachedCurrentlyExcludedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => path.startsWith('!')).map(path => path.slice(1))

    this._cachedCurrentlyScopedWorkspaceFolderNames = unique(this._cachedCurrentlyScopedPaths.map(path => path.split('/')[0]))

    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedCurrentlyExcludedPathsSet = new Set(this._cachedCurrentlyExcludedPaths)
    this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet = new Set(
      [...this._cachedCurrentlyScopedPaths, ...this._cachedCurrentlyExcludedPaths].flatMap(path => getParents(path))
    )
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

  getCachedCurrentlyScopedPathsSet() {
    return this._cachedCurrentlyScopedPathsSet
  }

  getCachedCurrentlyExcludedPathsSet() {
    return this._cachedCurrentlyExcludedPathsSet
  }

  getCachedParentsOfCurrentlyScopedAndExcludedPathsSet() {
    return this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet
  }
}