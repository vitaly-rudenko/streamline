import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider, type TabTreeItem } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { formatPaths } from '../../utils/format-paths'
import { fastFormatRelativeDate } from '../../utils/fast-format-relative-date'
import { TabHistoryWorkspaceState } from './tab-history-workspace-state'

const BACKUP_SIZE = 100

export function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const workspaceState = new TabHistoryWorkspaceState(context.workspaceState)
  const tabHistoryStorage = new TabHistoryStorage(100)
  tabHistoryStorage.import(workspaceState.getBackupRecords())

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage, workspaceState)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  const scheduleBackup = createDebouncedFunction(async () => {
    workspaceState.setBackupRecords(tabHistoryStorage.export(BACKUP_SIZE))
    await workspaceState.save()
  }, 5_000)

  const scheduleNewTab = createDebouncedFunction((path: string, openedAt: number) => {
    // Do not refresh tree view unless it's a new item to keep item focused after clicked
    const isNew = tabHistoryStorage.put({ path, openedAt })
    if (isNew) tabHistoryTreeDataProvider.refresh()

    scheduleBackup()
  }, 100)

  context.subscriptions.push(
    tabHistoryTreeView,
    // re-sort tabs in background
    tabHistoryTreeView.onDidChangeVisibility(() => {
      tabHistoryStorage.sort()
      tabHistoryTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.refresh', () => {
      tabHistoryStorage.sort()
      tabHistoryTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.clear', async () => {
      workspaceState.setBackupRecords({})

      tabHistoryStorage.clear()
      tabHistoryTreeDataProvider.refresh()

      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.pinTab', async (item: TabTreeItem) => {
      workspaceState.setPinnedPaths([...workspaceState.getPinnedPaths(), item.uri.path])
      tabHistoryTreeDataProvider.refresh()

      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.unpinTab', async (item: TabTreeItem) => {
      workspaceState.setPinnedPaths(workspaceState.getPinnedPaths().filter(path => path !== item.uri.path))
      tabHistoryTreeDataProvider.refresh()

      await workspaceState.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.quickOpen', async () => {
      const uri = vscode.window.activeTextEditor?.document.uri
      const tabPaths = tabHistoryStorage.list()
        .sort((a, b) => b.openedAt - a.openedAt)
        .filter((tab) => tab.path !== uri?.path)
        .map((tab) => tab.path)

      const now = Date.now()
      const labelToPathMap = new Map<string, string>()
      for (const [path, formattedPath] of formatPaths(tabPaths)) {
        const tab = tabHistoryStorage.list().find(tab => tab.path === path)!
        labelToPathMap.set(`${formattedPath} – ${fastFormatRelativeDate(tab.openedAt, now)}`, path)
      }

      const selectedLabel = await vscode.window.showQuickPick(
        [...labelToPathMap.keys()],
        { title: 'Select Recently Opened Tab' }
      )
      if (!selectedLabel) return

      const selectedTabPath = labelToPathMap.get(selectedLabel)!
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selectedTabPath))
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((event) => {
      const path = event?.document.uri.path
      if (!path) return

      const openedAt = Date.now()
      scheduleNewTab(path, openedAt)
    }),
  )

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)
}
