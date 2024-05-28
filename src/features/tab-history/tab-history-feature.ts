import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { config } from '../../config'

export function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const size = config.get<number>('tabHistory.size', 100)
  const enabled = config.get<boolean>('tabHistory.enabled', true)
  const records = config.get<Record<string, number>>('tabHistory.records', {})

  const tabHistoryStorage = new TabHistoryStorage(100)
  tabHistoryStorage.import(records)

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  context.subscriptions.push(
    tabHistoryTreeView,
    // re-sort tabs in background when panel is not visible
    tabHistoryTreeView.onDidChangeVisibility((event) => {
      tabHistoryStorage.sort()
      tabHistoryTreeDataProvider.refresh()
    })
  )

  let backupTimeoutId: NodeJS.Timeout | undefined
  function scheduleBackup() {
    if (!enabled) return
    if (backupTimeoutId !== undefined) {
      clearTimeout(backupTimeoutId)
    }

    backupTimeoutId = setTimeout(async () => {
      if (enabled) {
        await config.update('tabHistory.records', tabHistoryStorage.export(size))
      }
    }, 5_000)
  }

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)

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
    vscode.window.onDidChangeActiveTextEditor(async (event) => {
      const uri = event?.document.uri
      if (!uri) return

      const isNew = tabHistoryStorage.put({ path: uri.path, openedAt: Date.now() })
      if (isNew) tabHistoryTreeDataProvider.refresh()

      scheduleBackup()
    }),
  )
}
