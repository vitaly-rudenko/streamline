import * as vscode from 'vscode'
import { BookmarksTreeDataProvider } from './bookmarks-tree-data-provider'

type Position = {
  line: number
  character: number
}

type Range = {
  start: Position
  end: Position
}

export type Bookmark = {
  type: 'File'
  preview: string
  path: string
  range?: Range
}

export async function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const bookmarks: Bookmark[] = []
  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider()
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('bookmarks', bookmarksTreeDataProvider)
  )

  async function refresh() {}

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      if (selectedUris && selectedUris.length > 0) {
        for (const uri of selectedUris) {
          if ((await vscode.workspace.fs.stat(uri)).type !== vscode.FileType.File) continue

          bookmarks.push({
            type: 'File',
            path: uri.path,
            preview: uri.path.split('/').slice(-2).join('/'),
          })
        }

        bookmarksTreeDataProvider.setBookmarks(bookmarks)
        bookmarksTreeDataProvider.refresh()
        return
      }

      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      for (const selection of activeTextEditor.selections) {
        bookmarks.push({
          type: 'File',
          path: activeTextEditor.document.uri.path,
          range: selection,
          preview: selection.isEmpty
            ? activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range).trim()
            : activeTextEditor.document.getText(selection).trim(),
        })
      }

      bookmarksTreeDataProvider.setBookmarks(bookmarks)
      bookmarksTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add-to-list', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      const list = await vscode.window.showQuickPick(['default', 'list 1', 'list 2'], { title: 'Select list to add bookmark to' })
    })
  )

  await refresh()

  return { refresh }
}
