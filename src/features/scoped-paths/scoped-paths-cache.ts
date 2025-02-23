import { getParents } from '../../utils/get-parents'
import { unique } from '../../utils/unique'
import { BookmarksFeature } from '../bookmarks/bookmarks-feature'
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
    private readonly bookmarksFeature: BookmarksFeature | undefined,
  ) {
    this.update()
  }

  update() {
    this._cachedCurrentlyScopedAndExcludedPaths = this.workspaceState.getDynamicIsInQuickScope()
      ? [this.workspaceState.getDynamicQuickScopePath()]
      : this.workspaceState.getDynamicIsInBookmarksScope()
        ? (this.bookmarksFeature?.getScopeableBookmarkedPathsInCurrentBookmarksListSet() ?? [])
        : (this.config.getScopesObject()[this.workspaceState.getCurrentScope()] ?? [])

    this._cachedCurrentlyScopedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => !path.startsWith('!'))
    this._cachedCurrentlyExcludedPaths = this._cachedCurrentlyScopedAndExcludedPaths.filter(path => path.startsWith('!')).map(path => path.slice(1))

    this._cachedCurrentlyScopedWorkspaceFolderNames = unique(this._cachedCurrentlyScopedPaths.map(path => path.split('/')[0]))

    this._cachedCurrentlyScopedPathsSet = new Set(this._cachedCurrentlyScopedPaths)
    this._cachedCurrentlyExcludedPathsSet = new Set(this._cachedCurrentlyExcludedPaths)
    this._cachedParentsOfCurrentlyScopedAndExcludedPathsSet = new Set(
      [...this._cachedCurrentlyScopedPaths, ...this._cachedCurrentlyExcludedPaths]
        .flatMap(path => getParents(path))
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