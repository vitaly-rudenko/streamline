import * as vscode from 'vscode'
import { TabHistoryTreeDataProvider, type TabTreeItem } from './tab-history-tree-data-provider'
import { TabHistoryStorage } from './tab-history-storage'
import { TabHistoryConfig } from './tab-history-config'

const BACKUP_DEBOUNCE_MS = 1000

export async function createTabHistoryFeature(input: { context: vscode.ExtensionContext }) {
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
        await config.save()
      }
    }, BACKUP_DEBOUNCE_MS)
  }

  async function updateContext() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.tabHistory.backup.enabled', config.getBackupEnabled())
    } catch (error) {
      console.warn('Could not update context', error)
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

  async function setBackupEnabled(value: boolean) {
    config.setBackupEnabled(value)

    scheduleBackup()
    await updateContext()
    await config.save()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.enableBackup', async () => {
      await setBackupEnabled(true)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.disableBackup', async () => {
      await setBackupEnabled(false)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.pinTab', async (item: TabTreeItem) => {
      config.setPinnedPaths([...config.getPinnedPaths(), item.uri.path])
      tabHistoryTreeDataProvider.refresh()

      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.tabHistory.unpinTab', async (item: TabTreeItem) => {
      config.setPinnedPaths(config.getPinnedPaths().filter(path => path !== item.uri.path))
      tabHistoryTreeDataProvider.refresh()

      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('streamline.tabHistory')) {
        if (config.load()) {
          tabHistoryStorage.import(config.getBackupRecords())
          tabHistoryTreeDataProvider.refresh()
          await updateContext()
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
  tabHistoryStorage.import(config.getBackupRecords())
  await updateContext()

  // Update timestamps once a minute
  setInterval(() => tabHistoryTreeDataProvider.refresh(), 60_000)
}
