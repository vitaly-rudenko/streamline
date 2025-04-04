import * as vscode from 'vscode'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { RegisterCommand } from '../../register-command'
import { RelatedFilesFinder } from './related-files-finder'
import { LRUCache } from 'lru-cache'
import { formatPaths } from '../../utils/format-paths'

export function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  const config = new RelatedFilesConfig()
  const relatedFilesFinder = new RelatedFilesFinder(config)

  const bestMatchStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998)
  bestMatchStatusBarItem.text = '$(sparkle)'
  bestMatchStatusBarItem.name = 'Related Files: Open Best Match to Side'
  bestMatchStatusBarItem.tooltip = 'Related Files: Open Best Match to Side'
  bestMatchStatusBarItem.hide()

  const scheduleSoftRefresh = createDebouncedFunction(() => softRefresh(), 50)
  const scheduleHardRefresh = createDebouncedFunction(() => hardRefresh(), 250)

  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    await hardRefresh()
  }, 500)

  async function softRefresh() {
    await updateStatusBarItemInBackground()
  }

  async function hardRefresh() {
    bestMatchCache.clear()
    await updateStatusBarItemInBackground()
  }

  type BestMatchResult = { bestMatch: vscode.Uri | undefined }
  const bestMatchCache = new LRUCache<string, BestMatchResult>({ max: 100 })
  async function findBestMatch(uri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<BestMatchResult> {
    const cacheKey = `${workspaceFolder?.name ?? '#'}_${uri.path}`
    const cached = bestMatchCache.get(cacheKey)
    if (cached) return cached

    const [bestMatch] = await relatedFilesFinder.find(uri, workspaceFolder, 1)
    bestMatchCache.set(cacheKey, { bestMatch })

    return { bestMatch }
  }

  async function updateStatusBarItemInBackground() {
    try {
      bestMatchStatusBarItem.hide()

      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
      const { bestMatch } = await findBestMatch(activeTextEditor.document.uri, workspaceFolder)
      if (!bestMatch) return

      const formattedPaths = formatPaths([bestMatch.path, activeTextEditor.document.uri.path])
      bestMatchStatusBarItem.text = `$(sparkle) ${formattedPaths.get(bestMatch.path)}`
      bestMatchStatusBarItem.command = {
        title: 'Related Files: Open Best Match to Side',
        command: 'explorer.openToSide',
        arguments: [bestMatch],
      }
      bestMatchStatusBarItem.show()
    } catch (error) {
      console.warn('[ScopedPaths] Could not update status bar item', error)
    }
  }

  // Open "Quick Open" modal with list of all potentially related files
  registerCommand('streamline.relatedFiles.quickOpen', async (argument: unknown) => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const searchAllWorkspaceFolders = (
      argument &&
      typeof argument === 'object' &&
      'searchAllWorkspaceFolders' in argument &&
      typeof argument.searchAllWorkspaceFolders === 'boolean' &&
      argument.searchAllWorkspaceFolders
    )

    const workspaceFolder = searchAllWorkspaceFolders
      ? undefined
      : vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)

    type QuickPickItem = vscode.QuickPickItem & { match?: vscode.Uri; searchAllWorkspaceFolders?: boolean }
    const quickPick = vscode.window.createQuickPick<QuickPickItem>()

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (!selected) return quickPick.dispose()

      if (selected.searchAllWorkspaceFolders) {
        await vscode.commands.executeCommand('streamline.relatedFiles.quickOpen', { searchAllWorkspaceFolders: true })
      } else if (selected.match) {
        await vscode.window.showTextDocument(selected.match, { preview: false })
      } else {
        await vscode.commands.executeCommand('workbench.action.quickOpen')
      }

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async ({ item }) => {
      if (!item.match) return quickPick.dispose()

      await vscode.window.showTextDocument(
        item.match,
        { preview: false, viewColumn: vscode.ViewColumn.Beside }
      )

      quickPick.dispose()
    })

    quickPick.onDidHide(() => quickPick.dispose())
    quickPick.show()

    let loadingState: 'loading-first-batch' | 'loading-remaining-batches' | 'loaded' = 'loading-first-batch'
    const matches: vscode.Uri[] = []

    function refreshQuickPickItems() {
      const formattedPaths = formatPaths(matches.map(match => match.path))

      quickPick.items = [
        ...loadingState === 'loaded' && matches.length === 0 ? [{
          label: `No related files found in ${workspaceFolder ? workspaceFolder.name : 'workspace'}`,
          iconPath: new vscode.ThemeIcon('search-stop'),
        }] : [],
        ...matches.map(match => ({
          match,
          label: formattedPaths.get(match.path)!,
          description: vscode.workspace.asRelativePath(match, searchAllWorkspaceFolders ? true : false),
          iconPath: new vscode.ThemeIcon('sparkle'),
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })),
        ...loadingState === 'loading-first-batch' ? [{
          label: 'Searching...',
          iconPath: new vscode.ThemeIcon('sparkle'),
        }]: [],
        ...searchAllWorkspaceFolders ? [] : [{
          label: 'More options',
          kind: vscode.QuickPickItemKind.Separator,
        }, {
          label: 'Search in all workspace folders',
          iconPath: new vscode.ThemeIcon('search'),
          searchAllWorkspaceFolders: true,
        }],
      ]
    }

    refreshQuickPickItems()

    for await (const batch of relatedFilesFinder.stream(activeTextEditor.document.uri, workspaceFolder, 10)) {
      matches.push(...batch)
      loadingState = 'loading-remaining-batches'

      refreshQuickPickItems()
    }

    loadingState = 'loaded'
    refreshQuickPickItems()
  })

  // Immediately open the best match file in the editor
  registerCommand('streamline.relatedFiles.openBestMatch', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const { bestMatch } = await findBestMatch(activeTextEditor.document.uri, workspaceFolder)
    if (!bestMatch) return

    await vscode.window.showTextDocument(
      bestMatch,
      { preview: false }
    )
  })

  // Immediately open the best match file in the editor to the side
  registerCommand('streamline.relatedFiles.openBestMatchToSide', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const { bestMatch } = await findBestMatch(activeTextEditor.document.uri, workspaceFolder)
    if (!bestMatch) return

    await vscode.window.showTextDocument(
      bestMatch,
      { preview: false, viewColumn: vscode.ViewColumn.Beside }
    )
  })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('search.exclude') || event.affectsConfiguration('files.exclude')) {
        scheduleHardRefresh()
      }

      if (event.affectsConfiguration('streamline.relatedFiles')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    // Reload "Related files" panel when currently opened file changes
    vscode.window.onDidChangeActiveTextEditor(() => scheduleSoftRefresh()),
    // Refresh when window state changes (e.g. focused, minimized)
    vscode.window.onDidChangeWindowState(() => scheduleSoftRefresh()),
    // Clear files cache when files are created/deleted/renamed
    vscode.workspace.onDidCreateFiles(() => scheduleHardRefresh()),
    vscode.workspace.onDidDeleteFiles(() => scheduleHardRefresh()),
    vscode.workspace.onDidRenameFiles(() => scheduleHardRefresh()),
    // Clear files cache when workspace folders are added, renamed or deleted
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleHardRefresh()),
  )

  updateStatusBarItemInBackground()
}
