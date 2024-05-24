import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, type FileTreeItem, type FolderTreeItem, type SelectionTreeItem } from './bookmarks-tree-data-provider'

export type Bookmark = {
  type: 'Folder'
  uri: vscode.Uri
} | {
  type: 'File'
  uri: vscode.Uri
} | {
  type: 'Selection'
  uri: vscode.Uri
  selection: vscode.Selection
  preview: string
}

export async function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  let bookmarks: Bookmark[] = []
  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider()
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('bookmarks', bookmarksTreeDataProvider)
  )

  async function refresh() {}

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      if (selectedUris && selectedUris.length > 0) {
        for (const uri of selectedUris) {
          const fileType = (await vscode.workspace.fs.stat(uri)).type

          if (fileType === vscode.FileType.File || fileType === vscode.FileType.SymbolicLink) {
            bookmarks.push({
              type: 'File',
              uri,
            })
          } else if (fileType === vscode.FileType.Directory) {
            bookmarks.push({
              type: 'Folder',
              uri,
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
          type: 'Selection',
          uri: activeTextEditor.document.uri,
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
      const list = await vscode.window.showQuickPick(['default', 'list 1', 'list 2'], { title: 'Select list to add bookmark to' })
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.revealInExplorer', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
      await vscode.commands.executeCommand('revealInExplorer', item.uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.delete', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
      bookmarks = bookmarks.filter(bookmark => bookmark.uri.path !== item.uri.path)
      bookmarksTreeDataProvider.setBookmarks(bookmarks)
      bookmarksTreeDataProvider.refresh()
    })
  )

  await refresh()

  return { refresh }
}
