import assert from 'assert'
import { fromPartial } from '@total-typescript/shoehorn'
import { suite, before, test } from 'mocha'
import { BookmarksCache } from './bookmarks-cache'
import { BookmarksConfig } from './bookmarks-config'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'
import { Bookmark } from './common'
import { ArchivedListsTreeItem, BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, ListTreeItem, SelectionTreeItem } from './bookmarks-tree-data-provider'
import { Selection, Uri } from 'vscode'

suite('BookmarksTreeDataProvider', () => {
  let config: BookmarksConfig
  let workspaceState: BookmarksWorkspaceState
  let cache: BookmarksCache

  before(() => {
    config = fromPartial({
      getArchivedLists: () => [
        'list-1',
        'list-2',
      ],
      getBookmarks: () => [
        {
          list: 'list-1',
          type: 'file',
          uri: Uri.file('/path/to/file-1.txt'),
        },
        {
          list: 'list-2',
          type: 'folder',
          uri: Uri.file('/path/to/folder-1'),
        },
        {
          list: 'list-3',
          type: 'selection',
          uri: Uri.file('/path/to/file-1.txt'),
          selection: new Selection(2, 5, 2, 32),
          value: 'const hello = "world";',
          note: 'Hello world!',
        },
        {
          list: 'list-4',
          type: 'file',
          uri: Uri.file('/path/to/file-2.txt'),
        },
      ] as Bookmark[],
    })

    workspaceState = fromPartial({
      getCurrentList: () => 'list-3',
    })

    cache = new BookmarksCache(config, workspaceState)
  })

  suite('getChildren', () => {
    test('root', async () => {
      const provider = new BookmarksTreeDataProvider(cache, config, workspaceState)

      const children = await provider.getChildren()
      assert.strictEqual(children?.length, 3)

      assert.ok(children?.[0] instanceof ListTreeItem)
      assert.strictEqual(children?.[0].label, 'list-3')
      assert.strictEqual(children?.[0].contextValue, 'activeList')

      assert.ok(children?.[1] instanceof ListTreeItem)
      assert.strictEqual(children?.[1].label, 'list-4')
      assert.strictEqual(children?.[1].contextValue, 'list')

      assert.ok(children?.[2] instanceof ArchivedListsTreeItem)
      assert.strictEqual(children?.[2].label, 'Archive')
      assert.strictEqual(children?.[2].contextValue, 'archivedLists')
    })

    test('activeList', async () => {
      const provider = new BookmarksTreeDataProvider(cache, config, workspaceState)

      const listChildren = await provider.getChildren(
        (await provider.getChildren())
          ?.find((child) => child.contextValue === 'activeList')
      )
      assert.strictEqual(listChildren?.length, 1)

      assert.ok(listChildren?.[0] instanceof FileTreeItem)
      assert.strictEqual(listChildren?.[0].contextValue, 'virtualFile')

      const fileChildren = await provider.getChildren(listChildren?.[0])
      assert.strictEqual(fileChildren?.length, 1)

      assert.ok(fileChildren?.[0] instanceof SelectionTreeItem)
      assert.strictEqual(fileChildren?.[0].contextValue, 'selection')
    })

    test('archivedLists', async () => {
      const provider = new BookmarksTreeDataProvider(cache, config, workspaceState)

      const children = await provider.getChildren(
        (await provider.getChildren())
          ?.find((child) => child.contextValue === 'archivedLists')
      )
      assert.strictEqual(children?.length, 2)

      assert.ok(children?.[0] instanceof ListTreeItem)
      assert.strictEqual(children?.[0].label, 'list-1')
      assert.strictEqual(children?.[0].contextValue, 'archivedList')

      assert.ok(children?.[1] instanceof ListTreeItem)
      assert.strictEqual(children?.[1].label, 'list-2')
      assert.strictEqual(children?.[1].contextValue, 'archivedList')
    })

    test('archivedList', async () => {
      const provider = new BookmarksTreeDataProvider(cache, config, workspaceState)

      const archivedListsChildren = await provider.getChildren(
        (await provider.getChildren())
          ?.find((child) => child.contextValue === 'archivedLists')
      )

      const list1Children = await provider.getChildren(archivedListsChildren?.find((child) => child.label === 'list-1'))
      assert.strictEqual(list1Children?.length, 1)

      assert.ok(list1Children?.[0] instanceof FileTreeItem)
      assert.strictEqual(list1Children?.[0].contextValue, 'file')

      const list2Children = await provider.getChildren(archivedListsChildren?.find((child) => child.label === 'list-2'))
      assert.strictEqual(list2Children?.length, 1)

      assert.ok(list2Children?.[0] instanceof FolderTreeItem)
      assert.strictEqual(list2Children?.[0].contextValue, 'folder')
    })
  })
})
