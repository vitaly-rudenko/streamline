import * as vscode from 'vscode'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { RegisterCommand } from '../../register-command'
import { RelatedFile, RelatedFilesFinder } from './related-files-finder'
import { collapseString } from '../../utils/collapse-string'
import path, { basename } from 'path'

const MAX_RELATED_FILES_IN_STATUS_BAR_TOOLTIP = 10
const MAX_LABEL_LENGTH = 30
const COLLAPSED_INDICATOR = '⸱⸱⸱'

export function createRelatedFilesFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
}) {
  const { context, registerCommand } = input

  const config = new RelatedFilesConfig()
  const relatedFilesFinder = new RelatedFilesFinder(config)

  const relatedFilesStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998)
  relatedFilesStatusBarItem.name = 'Related Files'

  const scheduleSoftRefresh = createDebouncedFunction(() => softRefresh(), 100)
  const scheduleHardRefresh = createDebouncedFunction(() => hardRefresh(), 500)

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
        relatedFilesStatusBarItem.hide()
        return
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeTextEditor.document.uri)
      const relatedFiles = await relatedFilesFinder.find(activeTextEditor.document.uri, workspaceFolder)
      if (relatedFiles.length === 0) {
        relatedFilesStatusBarItem.hide()
        return
      }

      const [relatedFile, ...remainingRelatedFiles] = relatedFiles
      relatedFilesStatusBarItem.text = `$(sparkle) ${(formatRelatedFileLabel(relatedFile))}${remainingRelatedFiles.length > 0 ? ` +${remainingRelatedFiles.length}` : ''}`
      relatedFilesStatusBarItem.command = {
        title: 'Open Related File',
        command: 'vscode.open',
        arguments: [relatedFile.uri],
      }

      const tooltip = new vscode.MarkdownString()
      tooltip.isTrusted = true
      tooltip.supportThemeIcons = true
      tooltip.appendMarkdown(
        remainingRelatedFiles
          .slice(0, MAX_RELATED_FILES_IN_STATUS_BAR_TOOLTIP)
          .map(rf => `$(file) [${formatRelatedFileLabel(rf)}](command:vscode.open?${encodeURIComponent(JSON.stringify(rf.uri))})  `)
          .join('\n')
      )
      relatedFilesStatusBarItem.tooltip = tooltip
      relatedFilesStatusBarItem.show()
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
    if (!searchAllWorkspaceFolders && relatedFiles.length === 0) {
      await vscode.commands.executeCommand('streamline.relatedFiles.quickOpen', { searchAllWorkspaceFolders: true })
      return
    }

    const selected = await vscode.window.showQuickPick<vscode.QuickPickItem & {
      relatedFile?: RelatedFile
      searchAllWorkspaceFolders?: boolean
    }>([
      ...searchAllWorkspaceFolders && relatedFiles.length === 0 ? [{
        label: 'No related files found, try regular Quick Open?',
        iconPath: new vscode.ThemeIcon('search-stop'),
      }] : [],
      ...relatedFiles.map(relatedFile => ({
        label: relatedFile.label,
        description: path.relative(path.dirname(activeTextEditor.document.uri.path), relatedFile.uri.path),
        relatedFile,
        iconPath: relatedFile.isBestMatch ? new vscode.ThemeIcon('star-full') : new vscode.ThemeIcon('sparkle'),
      })),
      ...searchAllWorkspaceFolders ? [] : [{
        label: 'Search in all workspaces',
        iconPath: new vscode.ThemeIcon('search'),
        searchAllWorkspaceFolders: true,
      }],
    ])
    if (!selected) return

    if (selected.searchAllWorkspaceFolders) {
      await vscode.commands.executeCommand('streamline.relatedFiles.quickOpen', { searchAllWorkspaceFolders: true })
    } else if (selected.relatedFile) {
      await vscode.commands.executeCommand('vscode.open', selected.relatedFile.uri)
    } else {
      await vscode.commands.executeCommand('workbench.action.quickOpen')
    }
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
