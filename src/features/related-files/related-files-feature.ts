import * as vscode from 'vscode'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { RegisterCommand } from '../../register-command'
import { RelatedFile, RelatedFilesFinder } from './related-files-finder'

export function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  const config = new RelatedFilesConfig()
  const relatedFilesFinder = new RelatedFilesFinder(config)

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998)
  statusBarItem.text = '$(sparkle)'
  statusBarItem.name = 'Related Files: Open Best Match to Side'
  statusBarItem.tooltip = 'Open Best Match to Side'
  statusBarItem.hide()

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
    relatedFilesFinder.clearCache()
    await updateStatusBarItemInBackground()
  }

  async function updateStatusBarItemInBackground() {
    try {
      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) {
        statusBarItem.hide()
        return
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
      const relatedFiles = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder)
      if (relatedFiles.length === 0) {
        statusBarItem.hide()
        return
      }

      const [relatedFile, ...remainingRelatedFiles] = relatedFiles
      statusBarItem.text = `$(sparkle) ${relatedFile.label}${remainingRelatedFiles.length > 0 ? ` +${remainingRelatedFiles.length}` : ''}`
      statusBarItem.command = {
        title: 'Open Best Match to Side',
        command: 'explorer.openToSide',
        arguments: [relatedFile.uri],
      }
      statusBarItem.show()
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

    const relatedFiles = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder, { ignoreCache: true })

    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & {
      relatedFile?: RelatedFile
      searchAllWorkspaceFolders?: boolean
    }>()

    quickPick.items = [
      ...relatedFiles.length === 0 ? [{
        label: 'No related files found, trigger Quick Open?',
        iconPath: new vscode.ThemeIcon('search-stop'),
      }] : [],
      ...relatedFiles.map(relatedFile => ({
        label: relatedFile.label,
        description: vscode.workspace.asRelativePath(relatedFile.uri, workspaceFolder ? false : true),
        relatedFile,
        iconPath: new vscode.ThemeIcon('sparkle'),
        buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
      })),
      ...searchAllWorkspaceFolders ? [] : [{
        label: 'Search in all workspace folders',
        iconPath: new vscode.ThemeIcon('search'),
        searchAllWorkspaceFolders: true,
      }],
    ]

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (selected) {
        if (selected.searchAllWorkspaceFolders) {
          await vscode.commands.executeCommand('streamline.relatedFiles.quickOpen', { searchAllWorkspaceFolders: true })
        } else if (selected.relatedFile) {
          await vscode.window.showTextDocument(
            selected.relatedFile.uri,
            { preview: false }
          )
        } else {
          await vscode.commands.executeCommand('workbench.action.quickOpen')
        }
      }

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async ({ item }) => {
      if (!item.relatedFile) return
      await vscode.window.showTextDocument(
        item.relatedFile.uri,
        { preview: false, viewColumn: vscode.ViewColumn.Beside }
      )
    })

    quickPick.onDidHide(() => quickPick.dispose())

    quickPick.show()
  })

  // Immediately open the best match file in the editor
  registerCommand('streamline.relatedFiles.openBestMatch', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const [relatedFile] = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder, { ignoreCache: true })
    if (!relatedFile) return

    await vscode.window.showTextDocument(
      relatedFile.uri,
      { preview: false }
    )
  })

  // Immediately open the best match file in the editor to the side
  registerCommand('streamline.relatedFiles.openBestMatchToSide', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const [relatedFile] = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder, { ignoreCache: true })
    if (!relatedFile) return

    await vscode.window.showTextDocument(
      relatedFile.uri,
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
