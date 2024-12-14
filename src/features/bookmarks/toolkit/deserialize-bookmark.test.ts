import assert from 'assert'
import { suite } from 'mocha'
import { deserializeBookmark } from './deserialize-bookmark'
import { Uri, Selection } from 'vscode'
import { SerializedBookmark } from '../common'
import { join } from 'path'

suite('deserializeBookmark()', () => {
  test('deserializes bookmarks from JSON', () => {
    const serializedBookmarks: SerializedBookmark[] = [
      {
        list: 'list-1',
        type: 'file',
        uri: join(__dirname, '..', '__fixtures__', 'file-1.txt'),
      },
      {
        list: 'list-1',
        type: 'folder',
        uri: join(__dirname, '..', '__fixtures__'),
      },
      {
        list: 'list-1',
        type: 'selection',
        uri: join(__dirname, '..', '__fixtures__', 'file-1.txt'),
        selection: '2:5-2:32',
        value: 'console.log(\'Hello, world!\')',
        note: 'Hello world!',
      },
    ]

    const bookmarks = serializedBookmarks.map(deserializeBookmark)

    assert.strictEqual(bookmarks[0].uri.path, serializedBookmarks[0].uri)
    assert.strictEqual(bookmarks[0].list, 'list-1')
    assert.strictEqual(bookmarks[0].type, 'file')

    assert.strictEqual(bookmarks[1].uri.path, serializedBookmarks[1].uri)
    assert.strictEqual(bookmarks[1].list, 'list-1')
    assert.strictEqual(bookmarks[1].type, 'folder')

    assert.strictEqual(bookmarks[2].uri.path, serializedBookmarks[2].uri)
    assert.strictEqual(bookmarks[2].list, 'list-1')
    assert.strictEqual(bookmarks[2].type, 'selection')
    assert.ok(new Selection(2, 5, 2, 32).isEqual((bookmarks[2] as any).selection))
    assert.strictEqual((bookmarks[2] as any).value, 'console.log(\'Hello, world!\')')
  })
})
