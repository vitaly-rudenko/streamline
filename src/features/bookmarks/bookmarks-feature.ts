import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, ListTreeItem, SelectionTreeItem } from './bookmarks-tree-data-provider'
import { BookmarksConfig } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import type { Bookmark } from './types'
import { filter } from '../../utils/filter'
import { BookmarksCache } from './bookmarks-cache'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'
import { defaultCurrentList } from './constants'

const UNDO_HISTORY_SIZE = 10

export function createBookmarksFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  let undoHistory: Bookmark[][] = []

  const config = new BookmarksConfig()
  const workspaceState = new BookmarksWorkspaceState(context.workspaceState)
  const cache = new BookmarksCache(config, workspaceState)
  config.onChange = () => cache.update()
  workspaceState.onChange = () => cache.update()

  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider(cache, config, workspaceState)
  const bookmarksTreeView = vscode.window.createTreeView('bookmarks', {
    treeDataProvider: bookmarksTreeDataProvider,
    showCollapseAll: true,
  })

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    bookmarksTreeDataProvider.refresh()
  }, 500)

  async function updateContextInBackground() {
    try {
      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      const isActiveTextEditorBookmarked = activeTextEditorUri
        ? cache.getCachedBookmarkedFilePathsSet().has(activeTextEditorUri.path)
        : false

      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.activeTextEditorBookmarked', isActiveTextEditorBookmarked)
      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.isUndoHistoryEmpty', undoHistory.length === 0)
    } catch (error) {
      console.warn('[Bookmarks] Could not update context', error)
    }
  }

  async function promptListSelection() {
    const archiveItem = '------------ Archive ------------'

    let selectedList = await vscode.window.showQuickPick(
      [
        ...cache.getCachedSortedUnarchivedLists(),
        '+ Add new list',
        ...cache.getCachedSortedArchivedLists().length > 0 ? [archiveItem, ...cache.getCachedSortedArchivedLists()] : [],
      ],
      { title: 'Select Bookmarks List' }
    )
    if (!selectedList) return undefined
    if (selectedList === archiveItem) {
      return promptListSelection()
    }

    if (selectedList === '+ Add new list') {
      selectedList = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!selectedList) return
    }

    return selectedList
  }

	context.subscriptions.push(bookmarksTreeView)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined, note?: string | undefined) => {
      list ||= workspaceState.getCurrentList()

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
      if (uriOrFileTreeItem instanceof FileTreeItem) {
        await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem.uri, [uriOrFileTreeItem.uri], uriOrFileTreeItem.list)
      } else if (uriOrFileTreeItem) {
        await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem, [uriOrFileTreeItem])
      } else {
        const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
        if (activeTextEditorUri) {
          await vscode.commands.executeCommand('streamline.bookmarks.add', activeTextEditorUri, [activeTextEditorUri])
        }
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
    vscode.commands.registerCommand('streamline.bookmarks.editNote', async (item?: SelectionTreeItem) => {
      if (!item) return

      const oldNote = item.note
      const newNote = await vscode.window.showInputBox({ prompt: 'Enter the note', value: item?.note })
      if (newNote === undefined || oldNote === newNote) return

      const bookmarks = config.getBookmarks()
      if (!bookmarks.includes(item.bookmark)) {
        bookmarksTreeDataProvider.refresh()
        await vscode.window.showWarningMessage('Something went wrong, please try again')
        return
      }

      config.setBookmarks([
        ...bookmarks.filter((bookmark) => bookmark !== item.bookmark),
        {...item.bookmark, note: newNote === '' ? undefined : newNote},
      ])

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addNoteToList', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
      if (!note) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris, selectedList, note)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.changeCurrentList', async () => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      workspaceState.setCurrentList(selectedList)
      bookmarksTreeDataProvider.refresh()
      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.setListAsCurrent', async (item?: ListTreeItem) => {
      if (!item?.list) return

      workspaceState.setCurrentList(item?.list)
      bookmarksTreeDataProvider.refresh()
      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addList', async () => {
      const list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!list) return

      workspaceState.setCurrentList(list)
      bookmarksTreeDataProvider.refresh()
      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.renameList', async (item?: ListTreeItem) => {
      if (!item) return

      const oldName = item.list
      const newName = await vscode.window.showInputBox({ prompt: 'Enter new name of the list', value: oldName })
      if (!newName || newName === item.list) return

      let isNewList = !cache.getCachedUnsortedLists().includes(newName)
      if (!isNewList) {
        const result = await vscode.window.showInformationMessage(`List ${newName} already exists. Do you want to merge bookmarks?`, 'Yes, merge', 'Cancel')
        if (result !== 'Yes, merge') return
      }

      if (workspaceState.getCurrentList() === oldName) {
        workspaceState.setCurrentList(newName)
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
      await workspaceState.save()
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
      uri ??= vscode.window.activeTextEditor?.document.uri
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
        config.setArchivedLists(config.getArchivedLists().filter(list => list !== itemOrUri.list))

        if (workspaceState.getCurrentList() === itemOrUri.list) {
          workspaceState.setCurrentList(defaultCurrentList)
        }
      }

      const [bookmarks, removedBookmarks] = filter(
        config.getBookmarks(),
        (bookmark) => {
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
        }
      )

      if (removedBookmarks.length === 0) return

      undoHistory = [...undoHistory, removedBookmarks].slice(0, UNDO_HISTORY_SIZE)
      config.setBookmarks(bookmarks)

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.undo', async () => {
      const bookmarksToRestore = undoHistory.pop()
      if (!bookmarksToRestore) return

      config.setBookmarks([...config.getBookmarks(), ...bookmarksToRestore])

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    vscode.workspace.onDidRenameFiles((event) => {
      const oldPathNewUriMap = new Map(event.files.map(file => [file.oldUri.path, file.newUri]))

      config.setBookmarks(
        config.getBookmarks().map((bookmark) =>
          oldPathNewUriMap.has(bookmark.uri.path)
            ? { ...bookmark, uri: oldPathNewUriMap.get(bookmark.uri.path)! }
            : bookmark
        )
      )

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.bookmarks')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    })
  )

  updateContextInBackground()
}
