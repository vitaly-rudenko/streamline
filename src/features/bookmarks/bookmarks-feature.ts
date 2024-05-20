import * as vscode from 'vscode'

type Position = {
  line: number
  character: number
}

type Range = {
  start: Position
  end: Position
}

type Bookmark = {
  type: 'Path'
  path: string
  preview: string
} | {
  type: 'Line'
  path: string
  line: number
  preview: string
} | {
  type: 'Selection'
  path: string
  range: Range
  preview: string
} | {
  type: 'Symbol'
  kind: vscode.SymbolKind
  range: Range
  preview: string
}

export async function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const bookmarks: Bookmark[] = []

  async function refresh() {}

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      if (selectedUris && selectedUris.length > 0) {
        for (const uri of selectedUris) {
          bookmarks.push({
            type: 'Path',
            path: uri.path,
            preview: uri.path.split('/').at(-1)!,
          })
        }

        return
      }

      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      for (const selection of activeTextEditor.selections) {
        bookmarks.push(
          selection.isEmpty ? {
            type: 'Line',
            path: activeTextEditor.document.uri.path,
            line: activeTextEditor.selection.start.line,
            preview: activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range),
          } : {
            type: 'Selection',
            path: activeTextEditor.document.uri.path,
            range: selection,
            preview: activeTextEditor.document.getText(selection),
          }
        )
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add-to-list', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      const list = await vscode.window.showQuickPick(['default', 'list 1', 'list 2'], { canPickMany: true, title: 'Select list to add bookmark to' })

      await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris)
    })
  )

  await refresh()

  return { refresh }
}
