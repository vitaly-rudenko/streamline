import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, ListTreeItem, type SelectionTreeItem } from './bookmarks-tree-data-provider'
import { unique } from '../../utils/unique'

export type Bookmark = {
  uri: vscode.Uri
  list: string
} & (
  { type: 'folder' } |
  { type: 'file' } |
  {
    type: 'selection'
    selection: vscode.Selection
    preview: string
  }
)

export function createBookmarksFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  let bookmarks: Bookmark[] = []
  let currentList = 'default'

  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider()
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('bookmarks', bookmarksTreeDataProvider)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined) => {
      list ||= currentList

      if (selectedUris && selectedUris.length > 0) {
        for (const uri of selectedUris) {
          const fileType = (await vscode.workspace.fs.stat(uri)).type

          if (fileType === vscode.FileType.File || fileType === vscode.FileType.SymbolicLink) {
            bookmarks.push({
              type: 'file',
              uri,
              list,
            })
          } else if (fileType === vscode.FileType.Directory) {
            bookmarks.push({
              type: 'folder',
              uri,
              list,
            })
          }
        }

        bookmarksTreeDataProvider.setBookmarks(bookmarks)
        bookmarksTreeDataProvider.refresh()
        return
      }

      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      for (const selection of activeTextEditor.selections) {
        bookmarks.push({
          type: 'selection',
          uri: activeTextEditor.document.uri,
          list,
          selection,
          preview: (
            selection.isEmpty
              ? activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range).trim()
              : activeTextEditor.document.getText(selection).trim()
          ).slice(0, 256),
        })
      }

      bookmarksTreeDataProvider.setBookmarks(bookmarks)
      bookmarksTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addToList', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      const lists = unique([
        'default',
        ...bookmarks.map(bookmark => bookmark.list).sort(),
      ])

      let list = await vscode.window.showQuickPick(
        [...lists, '+ Add new list'],
        { title: 'Select a scope' }
      )
      if (!list) return

      if (list === '+ Add new list') {
        list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
        if (!list) return
      }

      await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris, list)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.changeCurrentList', async (item?: ListTreeItem) => {
      if (item) {
        currentList = item.list
      } else {
        const lists = unique([
          'default',
          ...bookmarks.map(bookmark => bookmark.list).sort(),
        ])

        let list = await vscode.window.showQuickPick(
          [...lists, '+ Add new list'],
          { title: 'Select a scope' }
        )
        if (!list) return

        if (list === '+ Add new list') {
          list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
          if (!list) return
        }

        currentList = list
      }

      bookmarksTreeDataProvider.setCurrentList(currentList)
      bookmarksTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.revealInExplorer', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
      await vscode.commands.executeCommand('revealInExplorer', item.uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.delete', async (item: ListTreeItem | FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
      if (item instanceof ListTreeItem) {
        // TODO: confirm deleting
        bookmarks = bookmarks.filter(bookmark => !(bookmark.list === item.list))
      } else if (item instanceof FolderTreeItem) {
        bookmarks = bookmarks.filter(bookmark => !(bookmark.type === 'folder' && bookmark.uri.path === item.uri.path))
      } else if (item instanceof FileTreeItem) {
        bookmarks = bookmarks.filter(bookmark => !(bookmark.type === 'file' && bookmark.uri.path === item.uri.path))
      } else {
        bookmarks = bookmarks.filter(bookmark => !(bookmark.type === 'selection' && bookmark.uri.path === item.uri.path && bookmark.selection.isEqual(item.selection)))
      }

      bookmarksTreeDataProvider.setBookmarks(bookmarks)
      bookmarksTreeDataProvider.refresh()
    })
  )
}
