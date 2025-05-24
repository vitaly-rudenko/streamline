import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, formatSelectionValue, ListTreeItem, SelectionTreeItem, TreeItem } from './bookmarks-tree-data-provider'
import { BookmarksConfig } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { BookmarksCache } from './bookmarks-cache'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'
import { Bookmark, defaultCurrentList } from './common'
import { getTargetItemsForCommand } from './toolkit/get-target-items-for-command'
import { formatPaths } from '../../utils/format-paths'
import { RegisterCommand } from '../../register-command'

const UNDO_HISTORY_SIZE = 50

export function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  onChange: () => unknown
}) {
  const { context, registerCommand, onChange } = input

  let sessionUndoHistoryCount = 0

  const config = new BookmarksConfig()
  const workspaceState = new BookmarksWorkspaceState(context.workspaceState)
  const cache = new BookmarksCache(config, workspaceState)

  config.onChange = () => {
    cache.update()
    onChange()
  }

  workspaceState.onChange = () => {
    cache.update()
    onChange()
  }

  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider(cache, config, workspaceState)
  const bookmarksTreeView = vscode.window.createTreeView('bookmarks', {
    treeDataProvider: bookmarksTreeDataProvider,
    showCollapseAll: true,
    canSelectMany: true,
  })

  context.subscriptions.push(bookmarksTreeView)

  const debouncedHandleConfigChanged = createDebouncedFunction(async () => {
    if (!config.load()) return

    // Update cache
    cache.update()

    // Update UI
    bookmarksTreeDataProvider.refresh()
    await tryUpdateContext()
  }, 500)

  const debouncedRefresh = createDebouncedFunction(async () => {
    // Update cache
    cache.update()

    // Update UI
    bookmarksTreeDataProvider.refresh()
    await tryUpdateContext()
  }, 250)

  context.subscriptions.push(debouncedHandleConfigChanged)

  async function saveAndRefresh() {
    // Save config
    await Promise.all([
      workspaceState.save(),
      config.saveInBackground(),
    ])

    // Update cache
    cache.update()

    // Update UI
    bookmarksTreeDataProvider.refresh()
    await tryUpdateContext()
  }

  async function tryUpdateContext() {
    try {
      const isActiveTextEditorBookmarked = vscode.window.activeTextEditor
        ? cache.getCachedBookmarkedPathsInCurrentBookmarksListSet().has(vscode.window.activeTextEditor.document.uri.path)
        : false

      await Promise.all([
        vscode.commands.executeCommand('setContext', 'streamline.bookmarks.showProminentUndoButton', sessionUndoHistoryCount > 0),
        vscode.commands.executeCommand('setContext', 'streamline.bookmarks.isActiveTextEditorBookmarked', isActiveTextEditorBookmarked),
        vscode.commands.executeCommand('setContext', 'streamline.bookmarks.isUndoHistoryEmpty', workspaceState.getUndoHistory().length === 0),
        vscode.commands.executeCommand('setContext', 'streamline.bookmarks.bookmarkedPaths', cache.getCachedBookmarkedPathsInCurrentBookmarksList()),
      ])
    } catch (error) {
      console.warn('[Bookmarks] Could not update context', error)
    }
  }

  async function promptListSelection() {
    let selected = await vscode.window.showQuickPick<vscode.QuickPickItem & { list?: string }>(
      [
        ...cache.getCachedSortedUnarchivedLists().map(list => ({
          label: list,
          iconPath: new vscode.ThemeIcon('bookmark'),
          description: workspaceState.getCurrentList() === list ? 'Current List' : undefined,
          list,
        })),
        { label: 'Add new list', iconPath: new vscode.ThemeIcon('add') }
      ],
      { title: 'Select Bookmarks List' }
    )
    if (!selected) return undefined

    let selectedList = selected.list
    if (!selectedList) {
      selectedList = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!selectedList) return
    }

    return selectedList
  }

  // Primary "Bookmark this..." command implementation
  registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined, note?: string | undefined) => {
    list ||= workspaceState.getCurrentList()

    // Add all selected files & folders in file tree
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
    } else { // Or add currently opened file
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

    await saveAndRefresh()
  })

  // Bookmark a file
  registerCommand('streamline.bookmarks.addFile', async (uriOrFileTreeItem: vscode.Uri | FileTreeItem | undefined) => {
    if (uriOrFileTreeItem instanceof FileTreeItem) { // When "virtualFile" is bookmarked
      await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem.uri, [uriOrFileTreeItem.uri], uriOrFileTreeItem.list)
    } else if (uriOrFileTreeItem) { // When real file is bookmarked (e.g. in file tree)
      await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem, [uriOrFileTreeItem])
    } else { // When currently opened file is bookmarked
      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      if (activeTextEditorUri) {
        await vscode.commands.executeCommand('streamline.bookmarks.add', activeTextEditorUri, [activeTextEditorUri])
      }
    }
  })

  // Bookmark current selection
  registerCommand('streamline.bookmarks.addSelection', async () => {
    const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
    if (!activeTextEditorUri) return

    await vscode.commands.executeCommand('streamline.bookmarks.add')
  })

  // Bookmark current selection with a note
  registerCommand('streamline.bookmarks.addSelectionWithNote', async () => {
    const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
    if (!activeTextEditorUri) return

    await vscode.commands.executeCommand('streamline.bookmarks.addNote')
  })

  // Bookmark to a custom list
  registerCommand('streamline.bookmarks.addToList', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, selectedList)
  })

  // Bookmark with a note
  registerCommand('streamline.bookmarks.addNote', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
    const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
    if (!note) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, undefined, note)
  })

  // Edit bookmark's note
  registerCommand('streamline.bookmarks.editNote', async (item?: SelectionTreeItem) => {
    if (!item) return

    const newNote = await vscode.window.showInputBox({ prompt: 'Enter the note', value: item?.note })
    if (newNote === undefined) return

    // Check if bookmark still exists
    const bookmarks = config.getBookmarks()
    const bookmarkToEdit = item.bookmark

    if (!bookmarks.includes(bookmarkToEdit)) {
      bookmarksTreeDataProvider.refresh()
      vscode.window.showWarningMessage('Something went wrong, please try again')
      return
    }

    if (bookmarkToEdit.note === newNote) return

    // Replace old bookmark with new bookmark (with updated note)
    config.setBookmarks([
      ...bookmarks.filter((bookmark) => bookmark !== bookmarkToEdit),
      { ...bookmarkToEdit, note: newNote === '' ? undefined : newNote },
    ])

    await saveAndRefresh()
  })

  // Move bookmarks to another list
  registerCommand('streamline.bookmarks.move', async (
    item?: FolderTreeItem | FileTreeItem | SelectionTreeItem,
    selectedItems?: (FolderTreeItem | FileTreeItem | SelectionTreeItem)[],
  ) => {
    const items = getTargetItemsForCommand(item, selectedItems)
      // We allow selecting virtual files for better UX, but it's not possible to move them because they're not real bookmarks
      .filter(item => item.contextValue !== 'virtualFile')
    if (items.length === 0) return

    const newList = await promptListSelection()
    if (!newList) return

    // Check if bookmark still exists after list selection
    const bookmarks = config.getBookmarks()
    const bookmarksToMove = bookmarks
      .filter(bookmark => items.some(item => bookmark.list === item.list && bookmark.uri.path === item.uri.path && bookmark.type === item.type))
      .filter(bookmark => bookmark.list !== newList)

    if (bookmarksToMove.length === 0) {
      bookmarksTreeDataProvider.refresh()
      return
    }

    config.setBookmarks([
      ...config.getBookmarks().filter((bookmark) => !bookmarksToMove.includes(bookmark)),
      ...bookmarksToMove.map(bookmark => ({ ...bookmark, list: newList })),
    ])

    await saveAndRefresh()
  })

  // Bookmark with a note to custom list
  registerCommand('streamline.bookmarks.addNoteToList', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
    if (!note) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris, selectedList, note)
  })

  // Select currently active bookmarks list
  registerCommand('streamline.bookmarks.changeCurrentList', async () => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    workspaceState.setCurrentList(selectedList)

    await saveAndRefresh()
  })

  // Set bookmarks list as currently active
  registerCommand('streamline.bookmarks.setListAsCurrent', async (item?: ListTreeItem) => {
    if (!item?.list) return

    workspaceState.setCurrentList(item?.list)

    await saveAndRefresh()
  })

  // 'Create' a new bookmarks list
  registerCommand('streamline.bookmarks.addList', async () => {
    const list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
    if (!list) return

    workspaceState.setCurrentList(list)

    await saveAndRefresh()
  })

  // Rename bookmarks list
  registerCommand('streamline.bookmarks.renameList', async (item?: ListTreeItem) => {
    if (!item) return

    const oldName = item.list
    const newName = await vscode.window.showInputBox({ prompt: 'Enter new name of the list', value: oldName })
    if (!newName || newName === item.list) return

    // Merge bookmarks lists if names match
    let isNewList = !cache.getCachedUnsortedLists().includes(newName)
    if (!isNewList) {
      const result = await vscode.window.showInformationMessage(`List ${newName} already exists. Do you want to merge bookmarks?`, 'Yes, merge', 'Cancel')
      if (result !== 'Yes, merge') return
    }

    // Make sure it stays active if it was active before renaming
    if (workspaceState.getCurrentList() === oldName) {
      workspaceState.setCurrentList(newName)
    }

    // Make sure it stays archived if it was archived before renaming
    if (config.getArchivedLists().includes(oldName)) {
      config.setArchivedLists(config.getArchivedLists().filter(list => list !== oldName))

      if (isNewList) {
        config.setArchivedLists([...config.getArchivedLists(), newName])
      }
    }

    // Update all bookmarks in the renamed list
    config.setBookmarks(
      config.getBookmarks().map((bookmark) => bookmark.list === oldName ? { ...bookmark, list: newName } : bookmark)
    )

    await saveAndRefresh()
  })

  // Archive bookmarks list
  registerCommand('streamline.bookmarks.archiveList', async (item?: ListTreeItem) => {
    if (!item) return
    if (config.getArchivedLists().includes(item.list)) return

    config.setArchivedLists([...config.getArchivedLists(), item.list])

    await saveAndRefresh()
  })

  // Unarchive bookmarks list
  registerCommand('streamline.bookmarks.unarchiveList', async (item?: ListTreeItem) => {
    if (!item) return
    if (!config.getArchivedLists().includes(item.list)) return

    config.setArchivedLists(config.getArchivedLists().filter(list => list !== item.list))

    await saveAndRefresh()
  })

  // Reveal bookmark (file) in the file tree
  registerCommand('streamline.bookmarks.revealInExplorer', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
    await vscode.commands.executeCommand('revealInExplorer', item.uri)
  })

  // Deletes file from bookmarks (bookmarked selections are not deleted)
  registerCommand('streamline.bookmarks.deleteFile', async (uri: vscode.Uri | undefined) => {
    uri ??= vscode.window.activeTextEditor?.document.uri
    await vscode.commands.executeCommand('streamline.bookmarks.delete', uri)
  })

  // Deletes all bookmarks in a list
  registerCommand('streamline.bookmarks.deleteList', async (item: unknown[], items: unknown[]) => {
    await vscode.commands.executeCommand('streamline.bookmarks.delete', item, items)
  })

  // Clear all bookmarks in a list
  registerCommand('streamline.bookmarks.clearList', async (item: unknown) => {
    const list = item instanceof ListTreeItem ? item.list : typeof item === 'string' ? item : undefined
    if (!list) return

    const bookmarksInList = config.getBookmarks().filter(bookmark => bookmark.list === list)
    if (bookmarksInList.length === 0) return

    // Save cleared bookmarks in workspace state to be able to revert the deletion
    workspaceState.setUndoHistory([...workspaceState.getUndoHistory(), bookmarksInList].slice(0, UNDO_HISTORY_SIZE))
    config.setBookmarks(config.getBookmarks().filter(bookmark => bookmark.list !== list))

    sessionUndoHistoryCount++

    await saveAndRefresh()
  })

  // Clear all bookmarks in the current list
  registerCommand('streamline.bookmarks.clearCurrentList', async () => {
    await vscode.commands.executeCommand('streamline.bookmarks.clearList', workspaceState.getCurrentList())
  })

  // Deletes an individual bookmark (file, folder or selection) or all bookmarks in a list
  registerCommand('streamline.bookmarks.delete', async (item?: TreeItem | vscode.Uri, selectedItems?: (TreeItem | vscode.Uri)[]) => {
    const targetItems = getTargetItemsForCommand(item, selectedItems)
    if (targetItems.length === 0) return

    let allBookmarksToDelete: Bookmark[] = []

    // All target items must either be Uris (Explorer View) or TreeItems (Bookmarks View)
    if (targetItems.some(item => item instanceof vscode.Uri) && targetItems.some(item => !(item instanceof vscode.Uri))) {
      console.error('[Bookmarks] Unexpected target items mismatch', targetItems)
      throw new Error('Unexpected target items mismatch')
    }

    // Case 1: Deleting bookmarks from Explorer View or using Bookmark button on top of the Editor
    if (targetItems.every(item => item instanceof vscode.Uri)) {
      const listToDeleteFrom = workspaceState.getCurrentList()

      const pathsToDelete = new Set(targetItems.map(item => item.path))
      const bookmarksToDelete = config.getBookmarks()
        .filter((bookmark) => bookmark.list === listToDeleteFrom && pathsToDelete.has(bookmark.uri.path))

      allBookmarksToDelete.push(...bookmarksToDelete)
    }
    // Case 2: Deleting bookmarks lists
    else if (targetItems.every(item => item instanceof ListTreeItem)) {
      const listsToDeleteFrom = targetItems.map(item => item.list)

      const bookmarksToDelete = config.getBookmarks()
        .filter((bookmark) => listsToDeleteFrom.includes(bookmark.list))

      // Remove 'archived' tag from the deleted lists
      config.setArchivedLists(config.getArchivedLists().filter(list => !listsToDeleteFrom.includes(list)))

      // Set current list to default if it was deleted
      if (listsToDeleteFrom.includes(workspaceState.getCurrentList())) {
        workspaceState.setCurrentList(defaultCurrentList)
      }

      allBookmarksToDelete.push(...bookmarksToDelete)
    }
    // Case 3: Deleting bookmarked files, folders and selections in Bookmarks View
    else if (targetItems.every(item => item instanceof vscode.TreeItem)) {
      for (const targetItem of targetItems) {
        const bookmarksToDelete = config.getBookmarks()
          .filter((bookmark) => {
            if (targetItem instanceof FolderTreeItem) {
              return bookmark.type === 'folder' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path
            }

            if (targetItem instanceof FileTreeItem) {
              return bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path
            }

            if (targetItem instanceof SelectionTreeItem) {
              return bookmark.type === 'selection' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path && bookmark.selection.isEqual(targetItem.selection)
            }

            console.error('[Bookmarks] Unexpected target item type', targetItem)
            throw new Error('Unexpected target item type')
          })

        allBookmarksToDelete.push(...bookmarksToDelete)
      }
    }

    const selectionsToDeleteCount = allBookmarksToDelete.filter(bookmark => bookmark.type === 'selection').length
    if (
      selectionsToDeleteCount > 0 &&
      !targetItems.every(item => item instanceof SelectionTreeItem || item instanceof FileTreeItem && item.contextValue === 'virtualFile')
    ) {
      const result = await vscode.window.showWarningMessage(
        `File${targetItems.length > 1 ? 's': ''} contain${targetItems.length > 1 ? '' : 's'} ${selectionsToDeleteCount} bookmarked selections. Do you want to delete them too?`,
        'No, keep selections',
        'Yes, delete all',
        'Cancel'
      )
      if (!result || result === 'Cancel') return
      if (result !== 'Yes, delete all') {
        allBookmarksToDelete = allBookmarksToDelete.filter(bookmark => bookmark.type !== 'selection')
      }
    }

    if (allBookmarksToDelete.length === 0) return // None were removed

    // Save deleted bookmarks in workspace state to be able to revert the deletion
    workspaceState.setUndoHistory([...workspaceState.getUndoHistory(), allBookmarksToDelete].slice(0, UNDO_HISTORY_SIZE))
    config.setBookmarks(config.getBookmarks().filter(bookmark => !allBookmarksToDelete.includes(bookmark)))

    sessionUndoHistoryCount++

    await saveAndRefresh()

    if (allBookmarksToDelete.length > 5) {
      const result = await vscode.window.showInformationMessage(
        `Deleted ${allBookmarksToDelete.length} bookmarks`,
        'OK',
        'Undo',
      )

      if (result === 'Undo') {
        await vscode.commands.executeCommand('streamline.bookmarks.undo')
      }
    }
  })

  // Reverts bookmarks deletion (stored in workspace state)
  registerCommand('streamline.bookmarks.undo', async () => {
    const bookmarksToRestore = workspaceState.getUndoHistory().at(-1)
    if (!bookmarksToRestore) return

    config.setBookmarks([...config.getBookmarks(), ...bookmarksToRestore])
    workspaceState.setUndoHistory(workspaceState.getUndoHistory().slice(0, -1))

    if (sessionUndoHistoryCount > 0) sessionUndoHistoryCount--

    await saveAndRefresh()
  })

  // Export all bookmarks as serialized JSON (opens the data in a new tab)
  registerCommand('streamline.bookmarks.exportAsJson', async () => {
    const serializedJsonExport = JSON.stringify({
      bookmarks: config.getSerializedBookmarks(),
      archivedLists: config.getArchivedLists(),
    }, null, 2)

    const document = await vscode.workspace.openTextDocument({
      content: serializedJsonExport,
      language: 'json',
    })

    await vscode.window.showTextDocument(document)
  })

  // Quickly open bookmark from the current bookmarks list
  registerCommand('streamline.bookmarks.quickOpen', async () => {
    const currentList = workspaceState.getCurrentList()

    const bookmarks = config.getBookmarks()
      // Filter by current list
      .filter(bookmark => bookmark.list === currentList)
      // Only files & selections
      .filter(bookmark => bookmark.type === 'file' || bookmark.type === 'selection')
      // Sort selections in files by line number
      .sort((a, b) => a.type === 'selection' && b.type === 'selection' ? a.selection.start.line - b.selection.start.line : 0)
      // Sort files to appear before selections inside them
      .sort((a, b) => a.type === b.type ? 0 : a.type === 'file' ? -1 : 1)
      // Group files & selections by same path
      .sort((a, b) => a.uri.path.localeCompare(b.uri.path))

    if (bookmarks.length === 0) {
      vscode.window.showInformationMessage(`You don't have bookmarks in "${currentList}" list yet`)
      return
    }

    const uris = bookmarks.map(bookmark => bookmark.uri)
    const formattedPaths = formatPaths(uris.map(uri => uri.path))

    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { bookmark: Bookmark }>()
    quickPick.items = bookmarks.flatMap((bookmark, i) => {
      const label = formattedPaths.get(bookmark.uri.path)!
      const results: (vscode.QuickPickItem & { bookmark: Bookmark })[] = []

      if (
        (i === 0 || bookmarks[i - 1].uri.path !== bookmark.uri.path)
        && !bookmarks.some(b => b.type === 'file' && b.uri.path === bookmark.uri.path)
      ) {
        results.push({
          label,
          description: vscode.workspace.asRelativePath(bookmark.uri.path),
          iconPath: new vscode.ThemeIcon('file'),
          bookmark: {
            type: 'file',
            list: bookmark.list,
            uri: bookmark.uri,
          },
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      }

      if (bookmark.type === 'selection') {
        const preview = formatSelectionValue(bookmark.selection, bookmark.value)

        results.push({
          label: `$(${bookmark.note ? 'note' : 'selection'}) ${bookmark.note ? bookmark.note : preview}`,
          description: bookmark.note ? preview : undefined,
          bookmark,
          iconPath: new vscode.ThemeIcon('indent'),
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      } else {
        results.push({
          label,
          description: vscode.workspace.asRelativePath(bookmark.uri.path),
          iconPath: new vscode.ThemeIcon('file'),
          bookmark,
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      }

      return results
    })

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (!selected) return quickPick.dispose()

      await vscode.window.showTextDocument(
        selected.bookmark.uri,
        {
          preview: false,
          ...selected.bookmark.type === 'selection' && {
            selection: selected.bookmark.selection,
          },
        }
      )

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async ({ item }) => {
      if (!item) return quickPick.dispose()

      await vscode.window.showTextDocument(
        item.bookmark.uri,
        {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
          ...item.bookmark.type === 'selection' && {
            selection: item.bookmark.selection,
          },
        }
      )

      quickPick.dispose()
    })

    quickPick.onDidHide(() => quickPick.dispose())
    quickPick.show()
  })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.bookmarks')) {
        if (!config.isSavingInBackground) {
          debouncedHandleConfigChanged.schedule()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => tryUpdateContext()),
    // Update bookmarks when corresponding files are renamed or moved
    vscode.workspace.onDidRenameFiles(async (event) => {
      const oldPathNewUriMap = new Map(event.files.map(file => [file.oldUri.path, file.newUri]))

      config.setBookmarks(
        config.getBookmarks().map((bookmark) =>
          oldPathNewUriMap.has(bookmark.uri.path)
            ? { ...bookmark, uri: oldPathNewUriMap.get(bookmark.uri.path)! }
            : bookmark
        )
      )

      await saveAndRefresh()
    }),
  )

  debouncedRefresh.schedule()

  return {
    isPathBookmarkedInCurrentBookmarksList(path: string) {
      return cache.getCachedBookmarkedPathsInCurrentBookmarksListSet().has(path)
    },
    getCachedBookmarksInCurrentBookmarksList() {
      return cache.getCachedBookmarksInCurrentBookmarksList()
    }
  }
}
