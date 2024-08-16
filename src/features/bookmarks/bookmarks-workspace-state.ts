import { Memento } from 'vscode'
import { defaultCurrentList } from './constants'

export class BookmarksWorkspaceState {
  public onChange?: Function

  private _currentList = defaultCurrentList

  constructor(
    private readonly workspaceState: Memento,
  ) {
    this.load()
  }

  private load() {
    const currentList = this.workspaceState.get<string>('streamline.bookmarks.currentList', defaultCurrentList)

  }

  async save() {
    await this.workspaceState.update(
      'streamline.bookmarks.currentList',
      this._currentList !== defaultCurrentList ? this._currentList : undefined
    )
  }

  getCurrentList() {
    return this._currentList
  }

  setCurrentList(value: string) {
    this._currentList = value
    this.onChange?.()
  }
}
