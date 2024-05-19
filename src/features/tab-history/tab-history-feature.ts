import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'

export async function createTabHistoryFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const tabHistoryStorage = new TabHistoryStorage(100)
  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(tabHistoryStorage)
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  context.subscriptions.push(
    tabHistoryTreeView,
    // re-sort tabs in background when panel is not visible
    tabHistoryTreeView.onDidChangeVisibility((event) => {
      if (!event.visible) {
        tabHistoryStorage.sort()
        tabHistoryTreeDataProvider.refresh()
      }
    })
  )

  let backupTimeoutId: NodeJS.Timeout | undefined
  function scheduleBackup() {
    if (backupTimeoutId !== undefined) {
      clearTimeout(backupTimeoutId)
    }

    backupTimeoutId = setTimeout(async () => {
      backupTimeoutId = undefined

      const config = vscode.workspace.getConfiguration('streamline')
      const size = config.get<number>('tabHistory.size', 100)
      const enabled = config.get<boolean>('tabHistory.enabled', true)

      if (enabled) {
        await config.update('tabHistory.records', tabHistoryStorage.export(size))
      }
    }, 5_000)
  }

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const records = config.get<Record<string, number>>('tabHistory.records', {})

    tabHistoryStorage.import(records)
    tabHistoryTreeDataProvider.refresh()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.refresh', async () => {
      await refresh()
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

  await refresh()

  return { refresh }
}
