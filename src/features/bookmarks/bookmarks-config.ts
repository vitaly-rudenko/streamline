import * as vscode from 'vscode'
import { getConfig } from '../../config'
import type { Bookmark, SerializedBookmark } from './types'
import { FeatureConfig } from '../feature-config'

const defaultCurrentList = 'default'

export class BookmarksConfig extends FeatureConfig {
  private _currentList = defaultCurrentList
  private _bookmarks: Bookmark[] = []
  private _cachedSerializedBookmarks: SerializedBookmark[] = []

  constructor() { super('Bookmarks') }

  load() {
    const config = getConfig()
    const currentList = config.get<string>('bookmarks.currentList', defaultCurrentList)
    const serializedBookmarks = config.get<SerializedBookmark[]>('bookmarks.serializedBookmarks', [])

    let hasChanged = false

    if (this._currentList !== currentList) {
      this._currentList = currentList

      hasChanged = true
    }

    if (JSON.stringify(this._cachedSerializedBookmarks) !== JSON.stringify(serializedBookmarks)) {
      this._cachedSerializedBookmarks = serializedBookmarks
      this._bookmarks = serializedBookmarks.map((serializedBookmark) => deserializeBookmark(serializedBookmark))

      hasChanged = true
    }

    console.debug('[Bookmarks] Config has been loaded', { hasChanged, currentList, serializedBookmarks })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'bookmarks.currentList',
      this._currentList !== defaultCurrentList ? this._currentList : undefined
    )

    await config.update(
      'bookmarks.serializedBookmarks',
      this._cachedSerializedBookmarks.length > 0 ? this._cachedSerializedBookmarks : undefined
    )

    console.debug('[Bookmarks] Config has been saved')
  }

  getCurrentList() {
    return this._currentList
  }

  setCurrentList(value: string) {
    this._currentList = value
  }

  getBookmarks() {
    return this._bookmarks
  }

  setBookmarks(value: Bookmark[]) {
    this._bookmarks = value
    this._cachedSerializedBookmarks = this._bookmarks.map((bookmark) => serializeBookmark(bookmark))
  }
}

function serializeBookmark(bookmark: Bookmark): SerializedBookmark {
  return {
    uri: bookmark.uri.path,
    list: bookmark.list,
    note: bookmark.note,
    ...bookmark.type === 'selection' ? {
      type: bookmark.type,
      preview: bookmark.preview,
      selection: {
        anchorLine: bookmark.selection.anchor.line,
        anchorCharacter: bookmark.selection.anchor.character,
        activeLine: bookmark.selection.active.line,
        activeCharacter: bookmark.selection.active.character,
      }
    } : {
      type: bookmark.type,
    }
  }
}


function deserializeBookmark(serializedBookmark: SerializedBookmark): Bookmark {
  return {
    uri: vscode.Uri.file(serializedBookmark.uri),
    list: serializedBookmark.list,
    note: serializedBookmark.note,
    ...serializedBookmark.type === 'selection' ? {
      type: serializedBookmark.type,
      preview: serializedBookmark.preview,
      selection: new vscode.Selection(
        serializedBookmark.selection.anchorLine,
        serializedBookmark.selection.anchorCharacter,
        serializedBookmark.selection.activeLine,
        serializedBookmark.selection.activeCharacter,
      )
    } : {
      type: serializedBookmark.type,
    }
  }
}
