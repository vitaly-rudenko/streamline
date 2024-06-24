import * as vscode from 'vscode'
import { getConfig, initialConfig } from '../../config'
import type { Bookmark, SerializedBookmark } from './types'
import { FeatureConfig } from '../feature-config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { unique } from '../../utils/unique'

export const defaultCurrentList = 'default'

export class BookmarksConfig extends FeatureConfig {
  private _currentList = defaultCurrentList
  private _archivedLists: string[] = []
  private _bookmarks: Bookmark[] = []
  private _cachedSerializedBookmarks: SerializedBookmark[] = []
  private _cachedUnsortedLists: string[] = []
  private _cachedSortedUnarchivedLists: string[] = []
  private _cachedSortedArchivedLists: string[] = []

  constructor() {
    super('Bookmarks')
    this.load()
    this._updateListsCache()
  }

  load(config = initialConfig) {
    const currentList = config.get<string>('bookmarks.currentList', defaultCurrentList)
    const archivedLists = config.get<string[]>('bookmarks.archivedLists', [])
    const serializedBookmarks = config.get<SerializedBookmark[]>('bookmarks.serializedBookmarks', [])

    let hasChanged = false

    if (
      this._currentList !== currentList
      || !areArraysShallowEqual(this._archivedLists, archivedLists)
    ) {
      this._currentList = currentList
      this._archivedLists = archivedLists

      hasChanged = true
    }

    if (JSON.stringify(this._cachedSerializedBookmarks) !== JSON.stringify(serializedBookmarks)) {
      this._cachedSerializedBookmarks = serializedBookmarks
      this._bookmarks = serializedBookmarks.map((serializedBookmark) => deserializeBookmark(serializedBookmark))

      hasChanged = true
    }

    if (hasChanged) {
      this._updateListsCache()
    }

    console.debug('[Bookmarks] Config has been loaded', { hasChanged, currentList, archivedLists, serializedBookmarks })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'bookmarks.currentList',
      this._currentList !== defaultCurrentList ? this._currentList : undefined
    )

    await config.update(
      'bookmarks.archivedLists',
      this._archivedLists.length > 0 ? this._archivedLists : undefined
    )

    await config.update(
      'bookmarks.serializedBookmarks',
      this._cachedSerializedBookmarks.length > 0 ? this._cachedSerializedBookmarks : undefined
    )

    console.debug('[Bookmarks] Config has been saved')
  }

  private _updateListsCache() {
    this._cachedUnsortedLists = unique([...this._bookmarks.map((bookmark) => bookmark.list), this.getCurrentList()])
    this._cachedSortedUnarchivedLists = this._cachedUnsortedLists.filter((list) => !this.getArchivedLists().includes(list)).sort()
    this._cachedSortedArchivedLists = [...this.getArchivedLists()].sort()
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

  getCurrentList() {
    return this._currentList
  }

  setCurrentList(value: string) {
    this._currentList = value
    this._updateListsCache()
  }

  getArchivedLists() {
    return this._archivedLists
  }

  setArchivedLists(value: string[]) {
    this._archivedLists = value
    this._updateListsCache()
  }

  getBookmarks() {
    return this._bookmarks
  }

  setBookmarks(value: Bookmark[]) {
    this._bookmarks = value
    this._cachedSerializedBookmarks = this._bookmarks.map((bookmark) => serializeBookmark(bookmark))
    this._updateListsCache()
  }
}

function serializeBookmark(bookmark: Bookmark): SerializedBookmark {
  return {
    uri: bookmark.uri.path,
    list: bookmark.list,
    note: bookmark.note,
    ...bookmark.type === 'selection' ? {
      type: bookmark.type,
      value: bookmark.value,
      selection: `${bookmark.selection.anchor.line}:${bookmark.selection.anchor.character}-${bookmark.selection.active.line}:${bookmark.selection.active.character}`
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
      value: 'value' in serializedBookmark ? serializedBookmark.value : serializedBookmark.preview,
      selection: parseSelection(serializedBookmark.selection),
    } : {
      type: serializedBookmark.type,
    }
  }
}

function parseSelection(serializedSelection: Extract<SerializedBookmark, { type: 'selection' }>['selection']): vscode.Selection {
  if (typeof serializedSelection === 'string') {
    const [anchorLine, anchorCharacter, activeLine, activeCharacter] = serializedSelection.split(/:|-/).map(Number)
    return new vscode.Selection(anchorLine, anchorCharacter, activeLine, activeCharacter)
  }

  return new vscode.Selection(
    serializedSelection.anchorLine,
    serializedSelection.anchorCharacter,
    serializedSelection.activeLine,
    serializedSelection.activeCharacter,
  )
}
