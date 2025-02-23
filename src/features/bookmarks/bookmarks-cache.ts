import { unique } from '../../utils/unique'
import { uriToPath } from '../../utils/uri'
import { BookmarksConfig } from './bookmarks-config'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'

export class BookmarksCache {
  private _cachedUnsortedLists: string[] = []
  private _cachedSortedUnarchivedLists: string[] = []
  private _cachedSortedArchivedLists: string[] = []
  private _cachedBookmarkedFilePathsInCurrentBookmarksListSet: Set<string> = new Set()
  private _cachedBookmarkedPathsInCurrentBookmarksListSet: Set<string> = new Set()
  private _cachedScopeableBookmarkedPathsInCurrentBookmarksList: string[] = []

  constructor(
    private readonly config: BookmarksConfig,
    private readonly workspaceState: BookmarksWorkspaceState,
  ) {
    this.update()
  }

  update() {
    this._cachedUnsortedLists = unique([...this.config.getBookmarks().map((bookmark) => bookmark.list), this.workspaceState.getCurrentList()])
    this._cachedSortedUnarchivedLists = this._cachedUnsortedLists.filter((list) => !this.config.getArchivedLists().includes(list)).sort()
    this._cachedSortedArchivedLists = [...this.config.getArchivedLists()].sort()
    this._cachedBookmarkedFilePathsInCurrentBookmarksListSet = new Set(this.config.getBookmarks().filter(b => b.list === this.workspaceState.getCurrentList()).filter(b => b.type === 'file').map(b => b.uri.path))
    this._cachedBookmarkedPathsInCurrentBookmarksListSet = new Set(this.config.getBookmarks().filter(b => b.list === this.workspaceState.getCurrentList()).map(b => b.uri.path))

    // TODO: probably doesn't belong in Bookmarks feature
    this._cachedScopeableBookmarkedPathsInCurrentBookmarksList = unique(
      this.config.getBookmarks()
        .filter(b => b.list === this.workspaceState.getCurrentList())
        .map(b => uriToPath(b.uri))
        .filter((path): path is string => path !== undefined)
    )
  }

  getCachedSortedArchivedLists() {
    return this._cachedSortedArchivedLists
  }

  getCachedSortedUnarchivedLists() {
    return this._cachedSortedUnarchivedLists
  }

  getCachedUnsortedLists() {
    return this._cachedUnsortedLists
  }

  getCachedBookmarkedFilePathsInCurrentBookmarksListSet() {
    return this._cachedBookmarkedFilePathsInCurrentBookmarksListSet
  }

  getCachedBookmarkedPathsInCurrentBookmarksListSet() {
    return this._cachedBookmarkedPathsInCurrentBookmarksListSet
  }

  getCachedScopeableBookmarkedPathsInCurrentBookmarksList() {
    return this._cachedScopeableBookmarkedPathsInCurrentBookmarksList
  }
}