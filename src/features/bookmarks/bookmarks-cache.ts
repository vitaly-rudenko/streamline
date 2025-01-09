import { unique } from '../../utils/unique'
import { BookmarksConfig } from './bookmarks-config'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'

export class BookmarksCache {
  private _cachedUnsortedLists: string[] = []
  private _cachedSortedUnarchivedLists: string[] = []
  private _cachedSortedArchivedLists: string[] = []
  private _cachedBookmarkedFilePathsSet: Set<string> = new Set()
  private _cachedBookmarkedPathsInCurrentBookmarksListSet: Set<string> = new Set()

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
    this._cachedBookmarkedFilePathsSet = new Set(this.config.getBookmarks().filter(b => b.type === 'file').map(b => b.uri.path))
    this._cachedBookmarkedPathsInCurrentBookmarksListSet = new Set(this.config.getBookmarks().filter(b => b.list === this.workspaceState.getCurrentList()).map(b => b.uri.path))
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

  getCachedBookmarkedFilePathsSet() {
    return this._cachedBookmarkedFilePathsSet
  }

  getCachedBookmarkedPathsInCurrentBookmarksListSet() {
    return this._cachedBookmarkedPathsInCurrentBookmarksListSet
  }
}