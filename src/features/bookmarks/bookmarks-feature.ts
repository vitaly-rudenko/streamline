import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, ListTreeItem, SelectionTreeItem } from './bookmarks-tree-data-provider'
import { BookmarksConfig, defaultCurrentList } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

export function createBookmarksFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new BookmarksConfig()
  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider(config)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    bookmarksTreeDataProvider.refresh()
  }, 500)

  async function updateContextInBackground() {
    try {
      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      const isActiveTextEditorBookmarked = activeTextEditorUri
        ? config.getBookmarks().some((bookmark) => bookmark.type === 'file' && bookmark.uri.path === activeTextEditorUri.path)
        : false

      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.activeTextEditorBookmarked', isActiveTextEditorBookmarked)
    } catch (error) {
      console.warn('[Bookmarks] Could not update context', error)
    }
  }

  async function promptListSelection() {
    let selectedList = await vscode.window.showQuickPick(
      [...config.getCachedSortedLists(), '+ Add new list'],
      { title: 'Select Bookmarks List' }
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
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined, note?: string | undefined) => {
      list ||= config.getCurrentList()

      if (selectedUris && selectedUris.length > 0) {
        const urisWithFileTypes = await Promise.all(
          selectedUris.map(async (uri) => ({ uri, fileType: (await vscode.workspace.fs.stat(uri)).type }))
        )

        config.setBookmarks([
          ...config.getBookmarks(),
          ...urisWithFileTypes
            .filter(({ fileType }) => fileType === vscode.FileType.File || fileType === vscode.FileType.SymbolicLink)
            .map(({ uri }) => ({ type: 'file', uri, list, note } as const)),
          ...urisWithFileTypes
            .filter(({ fileType }) => fileType === vscode.FileType.Directory)
            .map(({ uri }) => ({ type: 'folder', uri, list, note } as const)),
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
              note,
              list,
              selection,
              value: (
                selection.isEmpty
                  ? activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range)
                  : activeTextEditor.document.getText(selection)
              ),
            } as const
          })
        ])
      }

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addFile', async (uriOrFileTreeItem: vscode.Uri | FileTreeItem | undefined) => {
      if (!uriOrFileTreeItem) return

      if (uriOrFileTreeItem instanceof FileTreeItem) {
        await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem.uri, [uriOrFileTreeItem.uri])
      } else {
        await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem, [uriOrFileTreeItem])
      }
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
    vscode.commands.registerCommand('streamline.bookmarks.addNote', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
      const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
      if (!note) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, undefined, note)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addNoteToList', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
      if (!note) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, selectedList, note)
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
    vscode.commands.registerCommand('streamline.bookmarks.addList', async () => {
      const list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!list) return

      config.setCurrentList(list)
      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.renameList', async (item?: ListTreeItem) => {
      if (!item) return

      const oldName = item.list
      const newName = await vscode.window.showInputBox({ prompt: 'Enter new name of the list', value: oldName })
      if (!newName || newName === item.list) return

      let isNewList = !config.getCachedSortedLists().includes(newName)
      if (!isNewList) {
        const result = await vscode.window.showInformationMessage(`List ${newName} already exists. Do you want to merge bookmarks?`, 'Yes, merge', 'Cancel')
        if (result !== 'Yes, merge') return
      }

      if (config.getCurrentList() === oldName) {
        config.setCurrentList(newName)
      }

      if (config.getArchivedLists().includes(oldName)) {
        config.setArchivedLists(config.getArchivedLists().filter(list => list !== oldName))

        if (isNewList) {
          config.setArchivedLists([...config.getArchivedLists(), newName])
        }
      }

      config.setBookmarks(
        config.getBookmarks().map((bookmark) => bookmark.list === oldName ? {...bookmark, list: newName} : bookmark)
      )

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.archiveList', async (item?: ListTreeItem) => {
      if (!item) return
      if (config.getArchivedLists().includes(item.list)) return

      config.setArchivedLists([...config.getArchivedLists(), item.list])

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.unarchiveList', async (item?: ListTreeItem) => {
      if (!item) return
      if (!config.getArchivedLists().includes(item.list)) return

      config.setArchivedLists(config.getArchivedLists().filter(list => list !== item.list))

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
    vscode.commands.registerCommand('streamline.bookmarks.deleteFile', async (uri: vscode.Uri | undefined) => {
      if (!uri) return
      await vscode.commands.executeCommand('streamline.bookmarks.delete', uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.deleteList', async (item: ListTreeItem | undefined) => {
      if (!item) return
      await vscode.commands.executeCommand('streamline.bookmarks.delete', item)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.delete', async (itemOrUri: ListTreeItem | FileTreeItem | FolderTreeItem | SelectionTreeItem | vscode.Uri) => {
      if (itemOrUri instanceof ListTreeItem) {
        const result = await vscode.window.showInformationMessage(`Delete list '${itemOrUri.list}' and its bookmarks?`, 'Delete', 'Cancel')
        if (result !== 'Delete') return

        config.setArchivedLists(config.getArchivedLists().filter(list => list !== itemOrUri.list))

        if (config.getCurrentList() === itemOrUri.list) {
          config.setCurrentList(defaultCurrentList)
        }
      }

      config.setBookmarks(
        config.getBookmarks().filter(bookmark => {
          if (itemOrUri instanceof ListTreeItem) {
            return !(bookmark.list === itemOrUri.list)
          } else if (itemOrUri instanceof FolderTreeItem) {
            return !(bookmark.type === 'folder' && bookmark.uri.path === itemOrUri.uri.path)
          } else if (itemOrUri instanceof FileTreeItem) {
            return !(bookmark.type === 'file' && bookmark.uri.path === itemOrUri.uri.path)
          } else if (itemOrUri instanceof SelectionTreeItem) {
            return !(bookmark.type === 'selection' && bookmark.uri.path === itemOrUri.uri.path && bookmark.selection.isEqual(itemOrUri.selection))
          } else {
            return !(bookmark.type === 'file' && bookmark.uri.path === itemOrUri.path)
          }
        })
      )

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.bookmarks')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    })
  )

  config.load()
  updateContextInBackground()
}
