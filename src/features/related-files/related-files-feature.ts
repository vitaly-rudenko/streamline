import * as vscode from 'vscode'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { RegisterCommand } from '../../register-command'
import { RelatedFile, RelatedFilesFinder } from './related-files-finder'
import { collapseString } from '../../utils/collapse-string'
import { basename } from 'path'

const MAX_LABEL_LENGTH = 30
const COLLAPSED_INDICATOR = '⸱⸱⸱'

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
      statusBarItem.text = `$(sparkle) ${(formatRelatedFileLabel(relatedFile))}${remainingRelatedFiles.length > 0 ? ` +${remainingRelatedFiles.length}` : ''}`
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
        iconPath: relatedFile.isBestMatch ? new vscode.ThemeIcon('star-full') : new vscode.ThemeIcon('sparkle'),
        buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
      })),
      ...searchAllWorkspaceFolders ? [] : [{
        label: 'Search in all workspace folders',
        iconPath: new vscode.ThemeIcon('search'),
        searchAllWorkspaceFolders: true,
      }],
    ]

    quickPick.show()

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (selected) {
        if (selected.searchAllWorkspaceFolders) {
          await vscode.commands.executeCommand('streamline.relatedFiles.quickOpen', { searchAllWorkspaceFolders: true })
        } else if (selected.relatedFile) {
          await vscode.commands.executeCommand('vscode.open', selected.relatedFile.uri)
        } else {
          await vscode.commands.executeCommand('workbench.action.quickOpen')
        }
      }

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async (e) => {
      if (!e.item.relatedFile) return
      await vscode.commands.executeCommand('explorer.openToSide', e.item.relatedFile?.uri)
    })

    quickPick.onDidHide(() => quickPick.dispose())
  })

  // Immediately open the best match file in the editor
  registerCommand('streamline.relatedFiles.openBestMatch', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const relatedFiles = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder, { ignoreCache: true })
    if (relatedFiles.length === 0) return

    await vscode.commands.executeCommand('vscode.open', relatedFiles[0].uri)
  })

  // Immediately open the best match file in the editor to the side
  registerCommand('streamline.relatedFiles.openBestMatchToSide', async () => {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
    const relatedFiles = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder, { ignoreCache: true })
    if (relatedFiles.length === 0) return

    await vscode.commands.executeCommand('explorer.openToSide', relatedFiles[0].uri)
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

function formatRelatedFileLabel(relatedFile: RelatedFile) {
  return collapseString(relatedFile.label, basename(relatedFile.uri.path), MAX_LABEL_LENGTH, COLLAPSED_INDICATOR)
}
