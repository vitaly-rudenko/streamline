import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider } from './tab-history-tree-data-provider'
import { LRUCache } from 'lru-cache'
import type { Tab } from './types'

export async function createTabHistoryFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  // TODO: customizable history length (default: 10)
  const cache = new LRUCache<string, Tab>({ max: 10 })

  const tabHistoryTreeDataProvider = new TabHistoryTreeDataProvider(cache)
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('tabHistory', tabHistoryTreeDataProvider)
  )

  let dumpTimeoutId: NodeJS.Timeout | undefined
  function scheduleDump() {
    if (dumpTimeoutId !== undefined) {
      clearTimeout(dumpTimeoutId)
    }

    dumpTimeoutId = setTimeout(async () => {
      dumpTimeoutId = undefined
      const config = vscode.workspace.getConfiguration('streamline')
      await config.update('tabHistory', [...cache.values()].map(tab => [tab.path, tab.openedAt]))
    }, 5000)
  }

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')
    const tabHistory = config.get<[string, number][]>('tabHistory', [])

    cache.load(tabHistory.map(([path, openedAt]) => [path, { value: { path, openedAt } }]))

    tabHistoryTreeDataProvider.refresh()
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (event) => {
      const uri = event?.document.uri
      if (!uri) return

      cache.set(uri.path, { path: uri.path, openedAt: Date.now() })
      tabHistoryTreeDataProvider.refresh()

      scheduleDump()
    })
  )

  await refresh()

  return { refresh }
}
