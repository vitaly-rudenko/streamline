import { Memento } from 'vscode'
import { Bookmark, defaultCurrentList, SerializedBookmark } from './common'
import { deserializeBookmark } from './toolkit/deserialize-bookmark'
import { serializeBookmark } from './toolkit/serialize-bookmark'

export class BookmarksWorkspaceState {
  public onChange?: Function

  private _currentList = defaultCurrentList
  private _undoHistory: Bookmark[][] = []

  constructor(
    private readonly workspaceState: Memento,
  ) {
    this.load()
  }

  private load() {
    const currentList = this.workspaceState.get<string>('streamline.bookmarks.currentList', defaultCurrentList)
    const undoHistory = this.workspaceState.get<SerializedBookmark[][]>('streamline.bookmarks.undoHistory', [])

    this._currentList = currentList
    this._undoHistory = undoHistory.map(serializedBookmarks => (
      serializedBookmarks.map(serializedBookmark => deserializeBookmark(serializedBookmark))
    ))

    console.debug('[Bookmarks] WorkspaceState has been loaded', { currentList, undoHistory })
  }

  async save() {
    await this.workspaceState.update(
      'streamline.bookmarks.currentList',
      this._currentList !== defaultCurrentList ? this._currentList : undefined
    )

    await this.workspaceState.update(
      'streamline.bookmarks.undoHistory',
      this._undoHistory.length > 0 ? this._undoHistory.map(bookmarks => bookmarks.map(bookmark => serializeBookmark(bookmark))) : undefined
    )
  }

  getCurrentList() {
    return this._currentList
  }

  setCurrentList(value: string) {
    this._currentList = value
    this.onChange?.()
  }

  getUndoHistory() {
    return this._undoHistory
  }

  setUndoHistory(value: Bookmark[][]) {
    this._undoHistory = value
    this.onChange?.()
  }
}
