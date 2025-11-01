import z from 'zod'
import * as vscode from 'vscode'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { serializedBookmarkSchema, type Bookmark, type SerializedBookmark } from './common'
import { FeatureConfig } from '../feature-config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { serializeBookmark } from './toolkit/serialize-bookmark'
import { deserializeBookmark } from './toolkit/deserialize-bookmark'
import { deduplicateBookmarks } from './toolkit/deduplicate-bookmarks'

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
    const archivedLists = safeConfigGet(config, 'bookmarks.archivedLists', [], z.array(z.string()))
    const serializedBookmarks = safeConfigGet(config, 'bookmarks.serializedBookmarks', [], z.array(serializedBookmarkSchema))

    let hasChanged = false

    if (
      !areArraysShallowEqual(this._archivedLists, archivedLists)
      || JSON.stringify(this._serializedBookmarks) !== JSON.stringify(serializedBookmarks)
    ) {
      this._archivedLists = archivedLists
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

    await updateEffectiveConfig(
      config,
      vscode.ConfigurationTarget.Workspace,
      'bookmarks.archivedLists',
      exists => (exists || this._archivedLists.length > 0) ? this._archivedLists : undefined,
    )

    await updateEffectiveConfig(
      config,
      vscode.ConfigurationTarget.Workspace,
      'bookmarks.serializedBookmarks',
      exists => (exists || this._serializedBookmarks.length > 0) ? this._serializedBookmarks : undefined,
    )

    console.debug('[Bookmarks] Config has been saved')
  }

  getArchivedLists(): readonly string[] {
    return this._archivedLists
  }

  setArchivedLists(value: string[]) {
    this._archivedLists = value
    this.onChange?.()
  }

  getSerializedBookmarks(): readonly SerializedBookmark[] {
    return this._serializedBookmarks
  }

  getBookmarks(): readonly Bookmark[] {
    return this._bookmarks
  }

  setBookmarks(value: Bookmark[]) {
    this._bookmarks = deduplicateBookmarks(value)
    this._serializedBookmarks = this._bookmarks.map((bookmark) => serializeBookmark(bookmark))
    this.onChange?.()
  }
}
