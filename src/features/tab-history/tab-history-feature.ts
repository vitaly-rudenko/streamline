import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { TabHistoryConfig } from './tab-history-config'

export function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new TabHistoryConfig()

  const tabHistoryStorage = new TabHistoryStorage(100)

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  context.subscriptions.push(
    tabHistoryTreeView,
    // re-sort tabs in background
    tabHistoryTreeView.onDidChangeVisibility(() => {
      tabHistoryStorage.sort()
      tabHistoryTreeDataProvider.refresh()
    })
  )

  let backupTimeoutId: NodeJS.Timeout | undefined
  function scheduleBackup() {
    if (!config.backupEnabled) return
    if (backupTimeoutId !== undefined) {
      clearTimeout(backupTimeoutId)
    }

    backupTimeoutId = setTimeout(async () => {
      if (config.backupEnabled) {
        config.backupRecords = tabHistoryStorage.export(config.backupSize)
        await config.save()
      }
    }, 5_000)
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.refresh', async () => {
      tabHistoryStorage.sort()
      tabHistoryTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.clear', () => {
      tabHistoryStorage.clear()
      tabHistoryTreeDataProvider.refresh()

      scheduleBackup()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.tabHistory')) {
        if (config.load()) {
          tabHistoryStorage.import(config.backupRecords)
          tabHistoryTreeDataProvider.refresh()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(async (event) => {
      const uri = event?.document.uri
      if (!uri) return

      const isNew = tabHistoryStorage.put({ path: uri.path, openedAt: Date.now() })
      if (isNew) tabHistoryTreeDataProvider.refresh()

      scheduleBackup()
    }),
  )

  config.load()
  tabHistoryStorage.import(config.backupRecords)

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)
}
