import assert from 'assert'
import { suite, test } from 'mocha'
import { Uri, Selection } from 'vscode'
import { Bookmark } from '../common'
import { deduplicateBookmarks } from './deduplicate-bookmarks'

suite('deduplicateBookmarks()', () => {
  test('removes duplicate bookmarks', () => {
    const bookmarks: Bookmark[] = [
      {
        list: 'list-1',
        type: 'file',
        uri: Uri.file('/path/to/file-1.txt'),
      },
      {
        list: 'list-1',
        type: 'file',
        uri: Uri.file('/path/to/file-1.txt'),
      },
      {
        list: 'list-1',
        type: 'selection',
        uri: Uri.file('/path/to/file-2.txt'),
        selection: new Selection(2, 5, 2, 32),
        value: 'console.log(\'Hello, world!\')',
      },
      {
        list: 'list-1',
        type: 'selection',
        uri: Uri.file('/path/to/file-2.txt'),
        selection: new Selection(2, 5, 2, 32),
        value: 'console.log(\'Hello, world!\')',
      },
    ]

    const deduplicatedBookmarks = deduplicateBookmarks(bookmarks)

    assert.strictEqual(deduplicatedBookmarks.length, 2)
    assert.strictEqual(deduplicatedBookmarks[0].uri.path, '/path/to/file-1.txt')
    assert.strictEqual(deduplicatedBookmarks[1].uri.path, '/path/to/file-2.txt')
  })

  test('keeps unique bookmarks', () => {
    const bookmarks: Bookmark[] = [
      {
        list: 'list-1',
        type: 'file',
        uri: Uri.file('/path/to/file-1.txt'),
      },
      {
        list: 'list-2',
        type: 'file',
        uri: Uri.file('/path/to/file-2.txt'),
      },
      {
        list: 'list-1',
        type: 'selection',
        uri: Uri.file('/path/to/file-3.txt'),
        selection: new Selection(2, 5, 2, 32),
        value: 'console.log(\'Hello, world!\')',
      },
    ]

    const deduplicatedBookmarks = deduplicateBookmarks(bookmarks)

    assert.strictEqual(deduplicatedBookmarks.length, 3)
  })
})
