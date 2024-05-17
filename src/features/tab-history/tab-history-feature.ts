import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider } from './tab-history-tree-data-provider'

const MAX_HISTORY_SIZE_IN_MEMORY = 1_000

export async function createTabHistoryFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider()
  const tabHistoryTreeView = vscode.window.createTreeView('tabHistory', { treeDataProvider: tabHistoryTreeDataProvider })

  let cachedEnabled: boolean = false
  let cachedSize: number = Infinity

  context.subscriptions.push(
    tabHistoryTreeView,
    // re-sort tabs in background when panel is not visible
    tabHistoryTreeView.onDidChangeVisibility((event) => {
      if (!event.visible) {
        tabHistoryTreeDataProvider.tabs.sort((a, b) => b.openedAt - a.openedAt)
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
      if (!cachedEnabled) return

      const config = vscode.workspace.getConfiguration('streamline')
      await config.update(
        'tabHistory.records',
        [...tabHistoryTreeDataProvider.tabs]
          .sort((a, b) => b.openedAt - a.openedAt)
          .slice(0, cachedSize)
          .reduce<Record<string, number>>((acc, tab) => {
            acc[tab.path] = tab.openedAt
            return acc
          }, {})
      )
    }, 5_000)
  }

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const records = config.get<Record<string, number>>('tabHistory.records', {})
    const size = config.get<number>('tabHistory.size', 100)
    const enabled = config.get<boolean>('tabHistory.enabled', true)

    cachedEnabled = enabled
    cachedSize = size

    if (enabled) {
      // only load from backup once to avoid losing history in memory
      if (tabHistoryTreeDataProvider.tabs.length === 0) {
        tabHistoryTreeDataProvider.tabs = Object.entries(records)
          .map(([path, openedAt]) => ({ path, openedAt }))
          .sort((a, b) => b.openedAt - a.openedAt)
      }
    } else {
      // remove backup but keep in-memory functionality
      if (Object.entries(records).length > 0) {
        await config.update('tabHistory.records', undefined)
      }
    }

    tabHistoryTreeDataProvider.refresh()
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (event) => {
      const uri = event?.document.uri
      if (!uri) return

      const existingTab = tabHistoryTreeDataProvider.tabs.find(tab => tab.path === uri.path)
      if (existingTab) {
        existingTab.openedAt = Date.now()
      } else {
        tabHistoryTreeDataProvider.tabs.unshift({ path: uri.path, openedAt: Date.now() })
        if (tabHistoryTreeDataProvider.tabs.length > MAX_HISTORY_SIZE_IN_MEMORY) {
          tabHistoryTreeDataProvider.tabs.pop()
        }
      }

      tabHistoryTreeDataProvider.refresh()
      scheduleBackup()
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('streamline.tabHistory')) {
        await refresh()
      }
    }),
  )

  await refresh()

  return { refresh }
}
