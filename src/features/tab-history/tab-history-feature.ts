import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider, type TabTreeItem } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { TabHistoryConfig } from './tab-history-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { formatPaths } from '../../utils/format-paths'
import { fastFormatRelativeDate } from '../../utils/fast-format-relative-date'

export function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new TabHistoryConfig()
  const tabHistoryStorage = new TabHistoryStorage(100)
  tabHistoryStorage.import(config.getBackupRecords())

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage, config)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  const scheduleBackup = createDebouncedFunction(() => {
    if (!config.getBackupEnabled()) return
    config.setBackupRecords(tabHistoryStorage.export(config.getBackupSize()))
    config.saveInBackground()
  }, 5_000)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    tabHistoryStorage.import(config.getBackupRecords())
    tabHistoryTreeDataProvider.refresh()
    updateContextInBackground()
  }, 500)

  const scheduleNewTab = createDebouncedFunction((path: string, openedAt: number) => {
    // Do not refresh tree view unless it's a new item to keep item focused after clicked
    const isNew = tabHistoryStorage.put({ path, openedAt })
    if (isNew) tabHistoryTreeDataProvider.refresh()

    scheduleBackup()
  }, 100)

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.tabHistory.backup.enabled', config.getBackupEnabled())
    } catch (error) {
      console.warn('[TabHistory] Could not update context', error)
    }
  }

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
    vscode.commands.registerCommand('streamline.tabHistory.enableBackup', () => {
      config.setBackupEnabled(true)
      config.setBackupRecords(tabHistoryStorage.export(config.getBackupSize()))

      scheduleBackup()
      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.disableBackup', () => {
      config.setBackupEnabled(false)
      config.setBackupRecords({})

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.clear', () => {
      config.setBackupRecords({})

      tabHistoryStorage.clear()
      tabHistoryTreeDataProvider.refresh()

      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.pinTab', (item: TabTreeItem) => {
      config.setPinnedPaths([...config.getPinnedPaths(), item.uri.path])
      tabHistoryTreeDataProvider.refresh()

      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.unpinTab', (item: TabTreeItem) => {
      config.setPinnedPaths(config.getPinnedPaths().filter(path => path !== item.uri.path))
      tabHistoryTreeDataProvider.refresh()

      config.saveInBackground()
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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.tabHistory')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((event) => {
      const path = event?.document.uri.path
      if (!path) return

      const openedAt = Date.now()
      scheduleNewTab(path, openedAt)
    }),
  )

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)
  updateContextInBackground()
}
