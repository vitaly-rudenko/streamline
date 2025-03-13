import { Bookmark } from '../common'
import { serializeBookmark } from './serialize-bookmark'

export function deduplicateBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  const stringifiedSerializedBookmarkSet = new Set<string>()
  const deduplicatedBookmarks: Bookmark[] = []

  for (const bookmark of bookmarks) {
    const key = JSON.stringify(serializeBookmark(bookmark))
    if (stringifiedSerializedBookmarkSet.has(key)) continue

    stringifiedSerializedBookmarkSet.add(key)
    deduplicatedBookmarks.push(bookmark)
  }

  return deduplicatedBookmarks
}