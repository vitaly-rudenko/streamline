import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider, type TabTreeItem } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { TabHistoryConfig } from './tab-history-config'

const BACKUP_DEBOUNCE_MS = 5_000

export function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new TabHistoryConfig()
  const tabHistoryStorage = new TabHistoryStorage(100)
  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage, config)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  let backupTimeoutId: NodeJS.Timeout | undefined
  function scheduleBackup() {
    if (backupTimeoutId !== undefined) {
      clearTimeout(backupTimeoutId)
    }

    backupTimeoutId = setTimeout(async () => {
      if (config.getBackupEnabled()) {
        config.setBackupRecords(tabHistoryStorage.export(config.getBackupSize()))
        config.saveInBackground()
      }
    }, BACKUP_DEBOUNCE_MS)
  }

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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.tabHistory')) {
        if (!config.isSavingInBackground && config.load()) {
          tabHistoryStorage.import(config.getBackupRecords())
          tabHistoryTreeDataProvider.refresh()
          updateContextInBackground()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((event) => {
      const uri = event?.document.uri
      if (!uri) return

      const isNew = tabHistoryStorage.put({ path: uri.path, openedAt: Date.now() })
      if (isNew) tabHistoryTreeDataProvider.refresh()

      scheduleBackup()
    }),
  )

  config.load()
  tabHistoryStorage.import(config.getBackupRecords())
  updateContextInBackground()

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)
}
