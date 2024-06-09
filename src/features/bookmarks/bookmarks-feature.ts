import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, ListTreeItem, type SelectionTreeItem } from './bookmarks-tree-data-provider'
import { unique } from '../../utils/unique'
import { BookmarksConfig } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

export function createBookmarksFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new BookmarksConfig()
  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider(config)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    bookmarksTreeDataProvider.refresh()
  }, 1_000)

  async function promptListSelection() {
    let selectedList = await vscode.window.showQuickPick(
      unique(['default', ...config.getBookmarks().map(bookmark => bookmark.list).sort(), config.getCurrentList(), '+ Add new list']),
      { title: 'Select a scope' }
    )
    if (!selectedList) return undefined

    if (selectedList === '+ Add new list') {
      selectedList = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!selectedList) return
    }

    return selectedList
  }

	context.subscriptions.push(vscode.window.registerTreeDataProvider('bookmarks', bookmarksTreeDataProvider))

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined) => {
      list ||= config.getCurrentList()

      if (selectedUris && selectedUris.length > 0) {
        const urisWithFileTypes = await Promise.all(
          selectedUris.map(async (uri) => ({ uri, fileType: (await vscode.workspace.fs.stat(uri)).type }))
        )

        config.setBookmarks([
          ...config.getBookmarks(),
          ...urisWithFileTypes
            .filter(({ fileType }) => fileType === vscode.FileType.File || fileType === vscode.FileType.SymbolicLink)
            .map(({ uri }) => ({ type: 'file', uri, list } as const)),
          ...urisWithFileTypes
            .filter(({ fileType }) => fileType === vscode.FileType.Directory)
            .map(({ uri }) => ({ type: 'folder', uri, list } as const)),
        ])
      } else {
        const activeTextEditor = vscode.window.activeTextEditor
        if (!activeTextEditor) return

        config.setBookmarks([
          ...config.getBookmarks(),
          ...activeTextEditor.selections.map((selection) => {
            return {
              type: 'selection',
              uri: activeTextEditor.document.uri,
              list,
              selection,
              preview: (
                selection.isEmpty
                  ? activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range).trim()
                  : activeTextEditor.document.getText(selection).trim()
              ).slice(0, 256),
            } as const
          })
        ])
      }

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addToList', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, selectedList)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.changeCurrentList', async (item?: ListTreeItem) => {
      const selectedList = item?.list ?? await promptListSelection()
      if (!selectedList) return

      config.setCurrentList(selectedList)
      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
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
        const result = await vscode.window.showInformationMessage(`Delete list '${item.list}'?`, 'Delete', 'Cancel')
        if (result !== 'Delete') return
      }

      config.setBookmarks(
        config.getBookmarks().filter(bookmark => {
          if (item instanceof ListTreeItem) {
            return !(bookmark.list === item.list)
          } else if (item instanceof FolderTreeItem) {
            return !(bookmark.type === 'folder' && bookmark.uri.path === item.uri.path)
          } else if (item instanceof FileTreeItem) {
            return !(bookmark.type === 'file' && bookmark.uri.path === item.uri.path)
          } else {
            return !(bookmark.type === 'selection' && bookmark.uri.path === item.uri.path && bookmark.selection.isEqual(item.selection))
          }
        })
      )

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.bookmarks')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    })
  )

  config.load()
}
