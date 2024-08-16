import * as vscode from 'vscode'
import { getConfig, initialConfig } from '../../config'
import type { Bookmark, SerializedBookmark } from './types'
import { FeatureConfig } from '../feature-config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'

export class BookmarksConfig extends FeatureConfig {
  public onChange?: Function

  private _archivedLists: string[] = []
  private _serializedBookmarks: SerializedBookmark[] = []
  private _bookmarks: Bookmark[] = []

  constructor() {
    super('Bookmarks')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const archivedLists = config.get<string[]>('bookmarks.archivedLists', [])
    const serializedBookmarks = config.get<SerializedBookmark[]>('bookmarks.serializedBookmarks', [])

    let hasChanged = false

    if (
      !areArraysShallowEqual(this._archivedLists, archivedLists)
    ) {
      this._archivedLists = archivedLists

      hasChanged = true
    }

    if (JSON.stringify(this._serializedBookmarks) !== JSON.stringify(serializedBookmarks)) {
      this._serializedBookmarks = serializedBookmarks
      this._bookmarks = serializedBookmarks.map((serializedBookmark) => deserializeBookmark(serializedBookmark))

      hasChanged = true
    }

    if (hasChanged) {
      this.onChange?.()
    }

    console.debug('[Bookmarks] Config has been loaded', { hasChanged, archivedLists, serializedBookmarks })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'bookmarks.archivedLists',
      this._archivedLists.length > 0 ? this._archivedLists : undefined
    )

    await config.update(
      'bookmarks.serializedBookmarks',
      this._serializedBookmarks.length > 0 ? this._serializedBookmarks : undefined
    )

    console.debug('[Bookmarks] Config has been saved')
  }

  getArchivedLists() {
    return this._archivedLists
  }

  setArchivedLists(value: string[]) {
    this._archivedLists = value
    this.onChange?.()
  }

  getBookmarks() {
    return this._bookmarks
  }

  setBookmarks(value: Bookmark[]) {
    this._bookmarks = value
    this._serializedBookmarks = this._bookmarks.map((bookmark) => serializeBookmark(bookmark))
    this.onChange?.()
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
