import * as vscode from 'vscode'
import { NavigatorTreeDataProvider } from './navigator-tree-data-provider'
import { formatPaths } from '../../utils/format-paths'
import { NavigatorWorkspaceState } from './navigator-workspace-state'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { NavigatorConfig } from './navigator-config'

const MAX_NAVIGATOR_RECORDS_COUNT = 100

const activeThemeIcon = new vscode.ThemeIcon('circle-filled')
const inactiveThemeIcon = new vscode.ThemeIcon('circle-outline')

export function createNavigatorFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new NavigatorConfig()
  const workspaceState = new NavigatorWorkspaceState(context.workspaceState)

  const navigatorTreeDataProvider = new NavigatorTreeDataProvider(workspaceState)
  context.subscriptions.push(vscode.window.registerTreeDataProvider('navigator', navigatorTreeDataProvider))

  const fasterDebouncedStoreNavigatorRecord = createDebouncedFunction(() => storeNavigatorRecord(), 100)
  const slowerDebouncedStoreNavigatorRecord = createDebouncedFunction(() => storeNavigatorRecord(), 500)

  // Create and store new navigation record or replace existing one
  // Has to be wrapped in try/catch to avoid crashing the editor
  async function storeNavigatorRecord() {
    try {
      const newNavigatorRecord = createNavigatorRecord()
      if (!newNavigatorRecord) return

      // Reuse existing record if possible (e.g. replace current record or by going backward or forward)
      for (const indexOffset of generateIndexOffsets(config.getReuseRecordsOffset())) {
        const index = workspaceState.getIndex() + indexOffset
        const navigatorRecord = workspaceState.getNavigatorRecordAt(index)

        if (navigatorRecord && newNavigatorRecord.uri.path === navigatorRecord.uri.path) {
          workspaceState.replaceNavigationRecordAt(index, newNavigatorRecord)
          workspaceState.setIndex(index)

          navigatorTreeDataProvider.refresh()
          await workspaceState.save()
          return
        }
      }

      // Push record to the end of the list (top of the stack)
      workspaceState.setIndex(workspaceState.getIndex() + 1)
      workspaceState.setNavigatorRecords([
        ...workspaceState.getNavigatorRecords()
          .slice(0, workspaceState.getIndex()) // discard child records
          .slice(-MAX_NAVIGATOR_RECORDS_COUNT),
        newNavigatorRecord,
      ])

      navigatorTreeDataProvider.refresh()
      await workspaceState.save()
    } catch (error) {
      console.warn('[Navigator] Could not store record', error)
    }
  }

  function createNavigatorRecord() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor || activeTextEditor.document.isClosed || activeTextEditor.document.isUntitled) return

    const record = {
      uri: activeTextEditor.document.uri,
      selection: activeTextEditor.selection,
      value: activeTextEditor.document.lineAt(activeTextEditor.selection.start.line).text.trim(),
    }

    return record
  }

  // Jumps to existing record by index without modifying the history, and opens it in the editor
  async function jumpToRecord(i: number) {
    if (workspaceState.getIndex() === i) return

    const record = workspaceState.getNavigatorRecordAt(i)
    if (!record) return

    workspaceState.setIndex(i)
    navigatorTreeDataProvider.refresh()
    await workspaceState.save()

    await vscode.commands.executeCommand('vscode.open', record.uri, { selection: record.selection })
  }

  // Go back in the history without modifying it
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.goBack', async () => {
      if (workspaceState.getIndex() > 0) {
        await jumpToRecord(workspaceState.getIndex() - 1)
      }
    }),
  )

  // Go forward in the history without modifying it
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.goForward', async () => {
      if (workspaceState.getIndex() < workspaceState.getNavigatorRecords().length - 1) {
        await jumpToRecord(workspaceState.getIndex() + 1)
      }
    }),
  )

  // Clear all records except for the current one
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.clearRecords', async () => {
      workspaceState.setIndex(-1)
      workspaceState.setNavigatorRecords([])
      navigatorTreeDataProvider.refresh()

      await storeNavigatorRecord()
    }),
  )

  // Alternative access to Navigator records via Quick Open modal
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.quickOpen', async () => {
      if (workspaceState.getNavigatorRecords().length === 0) return

      const index = workspaceState.getIndex()
      const navigatorRecords = workspaceState.getNavigatorRecords()
      const formattedPaths = formatPaths(navigatorRecords.map(record => record.uri.path))

      const selected = await vscode.window.showQuickPick(
        navigatorRecords
          .map((record, i) => ({
            label: formattedPaths.get(record.uri.path)!,
            description: `${record.selection.start.line + 1}: ${record.value}`,
            iconPath: i <= index ? activeThemeIcon : inactiveThemeIcon,
            index: i,
          }))
          .reverse()
      )
      if (!selected) return

      await jumpToRecord(selected.index)
    }),
  )

  // Used internally by the view when clicking on a record
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.jumpToRecord', async (input?: { index?: number }) => {
      if (typeof input?.index === 'number') {
        await jumpToRecord(input.index)
      }
    })
  )

  // Refreshes the navigator view
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.refresh', async () => {
      navigatorTreeDataProvider.refresh()
      await storeNavigatorRecord()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.navigator')) {
        if (!config.isSavingInBackground) {
          config.load()
        }
      }
    }),
    // Delay is slower to avoid unnecessary refreshes
    vscode.window.onDidChangeTextEditorSelection(() => slowerDebouncedStoreNavigatorRecord()),
    // Note: delay IS REQUIRED here, without it the selection is always 0:0-0:0 initially
    vscode.window.onDidChangeActiveTextEditor(() => fasterDebouncedStoreNavigatorRecord())
  )

  storeNavigatorRecord()
}

function generateIndexOffsets(maxOffset: number) {
  const indexOffsets = [0]

  for (let i = 1; i <= maxOffset; i++) {
    indexOffsets.push(i, -i)
  }

  return indexOffsets
}
