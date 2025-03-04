import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem, type WorkspaceFolderTreeItem } from './related-files-tree-data-provider'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { unique } from '../../utils/unique'
import { getSmartBasename } from './toolkit/get-smart-basename'
import { RegisterCommand } from '../../register-command'
import { RelatedFile, RelatedFilesFinder } from './related-files-finder'
import { collapseString } from '../../utils/collapse-string'
import { basename } from 'path'

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
  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider(config, relatedFilesFinder)

  const relatedFilesStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998)
  relatedFilesStatusBarItem.name = 'Related Files'

  const scheduleSoftRefresh = createDebouncedFunction(() => softRefresh(), 50)
  const scheduleHardRefresh = createDebouncedFunction(() => hardRefresh(), 500)

  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    await hardRefresh()
  }, 500)

  async function softRefresh() {
    relatedFilesTreeDataProvider.refresh()
    await updateStatusBarItemInBackground()
    await updateContextInBackground()
  }

  async function hardRefresh() {
    relatedFilesFinder.clearCache()
    relatedFilesTreeDataProvider.refresh()
    await updateStatusBarItemInBackground()
    await updateContextInBackground()
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useExcludes', config.getUseExcludes())
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useGlobalSearch', config.getUseGlobalSearch())
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
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

  context.subscriptions.push(vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider))

  // Open "Quick Open" modal with pre-filled search query for the related files of currently opened file
  registerCommand('streamline.relatedFiles.quickOpen', async (uri: vscode.Uri | undefined) => {
    uri ||= vscode.window.activeTextEditor?.document.uri
    if (!uri) return

    const workspaceFolder = isMultiRootWorkspace() && !config.getUseGlobalSearch()
      ? vscode.workspace.getWorkspaceFolder(uri)
      : undefined

    const basename = getSmartBasename(uri.path, config.getExcludedSuffixes()).replaceAll(/[-_]/g, ' ')

    const query = workspaceFolder ? `${workspaceFolder.name}/${basename}` : basename

    await vscode.commands.executeCommand('workbench.action.quickOpen', query)
  })

  // Reload "Related files" panel
  registerCommand('streamline.relatedFiles.refresh', async () => {
    await hardRefresh()
  })

  // Open related file side-by-side (button in "Related files" panel)
  registerCommand('streamline.relatedFiles.openToSide', async (item?: RelatedFileTreeItem) => {
    if (!item?.resourceUri) return
    await vscode.commands.executeCommand('explorer.openToSide', item.resourceUri)
  })

  // Hide files from the selected workspace folder from the related files list (context menu item in "Related files" panel)
  registerCommand('streamline.relatedFiles.hideWorkspaceFolderInGlobalSearch', async (item?: WorkspaceFolderTreeItem) => {
    if (!item) return

    config.setHiddenWorkspaceFoldersInGlobalSearch(
      unique([
        ...config.getHiddenWorkspaceFoldersInGlobalSearch(),
        item.workspaceFolder.name,
      ])
    )
    config.saveInBackground()

    await hardRefresh()
  })

  // Toggle "Use Excludes" option
  registerCommand('streamline.relatedFiles.enableUseExcludes', async () => {
    config.setUseExcludes(true)
    config.saveInBackground()

    await hardRefresh()
  })

  registerCommand('streamline.relatedFiles.disableUseExcludes', async () => {
    config.setUseExcludes(false)
    config.saveInBackground()

    await hardRefresh()
  })

  // Toggle "Use Global Search" option
  registerCommand('streamline.relatedFiles.enableUseGlobalSearch', async () => {
    config.setUseGlobalSearch(true)
    config.saveInBackground()

    await hardRefresh()
  })

  registerCommand('streamline.relatedFiles.disableUseGlobalSearch', async () => {
    config.setUseGlobalSearch(false)
    config.saveInBackground()

    await hardRefresh()
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

  updateContextInBackground()
  updateStatusBarItemInBackground()
}

function formatRelatedFileLabel(relatedFile: RelatedFile) {
  return collapseString(relatedFile.label, basename(relatedFile.uri.path), MAX_LABEL_LENGTH, COLLAPSED_INDICATOR)
}
