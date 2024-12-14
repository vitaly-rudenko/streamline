import assert from 'assert'
import { suite } from 'mocha'
import { deserializeBookmark } from './deserialize-bookmark'
import { Uri, Selection } from 'vscode'
import { Bookmark, SerializedBookmark } from '../common'
import { join } from 'path'
import { serializeBookmark } from './serialize-bookmark'

suite('serializeBookmark()', () => {
  test('serializes bookmarks to JSON', () => {
    const bookmarks: Bookmark[] = [
      {
        list: 'list-1',
        type: 'file',
        uri: Uri.file(join(__dirname, '..', '__fixtures__', 'file-1.txt')),
      },
      {
        list: 'list-1',
        type: 'folder',
        uri: Uri.file(join(__dirname, '..', '__fixtures__')),
      },
      {
        list: 'list-1',
        type: 'selection',
        uri: Uri.file(join(__dirname, '..', '__fixtures__', 'file-1.txt')),
        selection: new Selection(2, 5, 2, 32),
        value: 'console.log(\'Hello, world!\')',
        note: 'Hello world!',
      },
    ]

    const serializedBookmarks = bookmarks.map(serializeBookmark)

    assert.deepStrictEqual(serializedBookmarks, [
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
    ])
  })
})
