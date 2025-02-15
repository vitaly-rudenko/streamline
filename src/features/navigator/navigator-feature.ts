import * as vscode from 'vscode'
import { NavigatorTreeDataProvider } from './navigator-tree-data-provider'
import { formatPaths } from '../../utils/format-paths'
import { NavigatorWorkspaceState } from './navigator-workspace-state'
import { areNavigatorRecordsEqual } from './common'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

const MAX_NAVIGATOR_RECORDS_COUNT = 100

export function createNavigatorFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const workspaceState = new NavigatorWorkspaceState(context.workspaceState)

  const navigatorTreeDataProvider = new NavigatorTreeDataProvider(workspaceState)
  context.subscriptions.push(vscode.window.registerTreeDataProvider('navigator', navigatorTreeDataProvider))

  const debouncedStoreNavigatorRecord = createDebouncedFunction(() => storeNavigatorRecord(), 100)

  async function storeNavigatorRecord() {
    const newNavigatorRecord = createNavigatorRecord()
    if (!newNavigatorRecord) return

    const currentNavigatorRecord = workspaceState.getNavigatorRecordAt(workspaceState.getIndex())
    if (currentNavigatorRecord && areNavigatorRecordsEqual(newNavigatorRecord, currentNavigatorRecord)) {
      workspaceState.replaceNavigationRecordAt(workspaceState.getIndex(), newNavigatorRecord)

      navigatorTreeDataProvider.refresh()
      await workspaceState.save()
      return
    }

    const prevNavigatorRecord = workspaceState.getNavigatorRecordAt(workspaceState.getIndex() - 1)
    if (prevNavigatorRecord && areNavigatorRecordsEqual(newNavigatorRecord, prevNavigatorRecord)) {
      workspaceState.setIndex(workspaceState.getIndex() - 1)
      workspaceState.replaceNavigationRecordAt(workspaceState.getIndex(), newNavigatorRecord)

      navigatorTreeDataProvider.refresh()
      await workspaceState.save()
      return
    }

    const nextNavigatorRecord = workspaceState.getNavigatorRecordAt(workspaceState.getIndex() + 1)
    if (nextNavigatorRecord && areNavigatorRecordsEqual(newNavigatorRecord, nextNavigatorRecord)) {
      workspaceState.setIndex(workspaceState.getIndex() + 1)
      workspaceState.replaceNavigationRecordAt(workspaceState.getIndex(), newNavigatorRecord)

      navigatorTreeDataProvider.refresh()
      await workspaceState.save()
      return
    }

    workspaceState.setIndex(workspaceState.getIndex() + 1)
    workspaceState.setNavigatorRecords([
      ...workspaceState.getNavigatorRecords()
        .slice(0, workspaceState.getIndex()) // discard child records
        .slice(-MAX_NAVIGATOR_RECORDS_COUNT),
      newNavigatorRecord,
    ])

    navigatorTreeDataProvider.refresh()
    await workspaceState.save()
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

  async function jumpToRecord(i: number) {
    if (workspaceState.getIndex() === i) return

    const record = workspaceState.getNavigatorRecordAt(i)
    if (!record) return

    workspaceState.setIndex(i)
    navigatorTreeDataProvider.refresh()
    await workspaceState.save()

    await vscode.commands.executeCommand('vscode.open', record.uri, { selection: record.selection })
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.goBack', async () => {
      if (workspaceState.getIndex() > 0) {
        await jumpToRecord(workspaceState.getIndex() - 1)
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.goForward', async () => {
      if (workspaceState.getIndex() < workspaceState.getNavigatorRecords().length - 1) {
        await jumpToRecord(workspaceState.getIndex() + 1)
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.clearRecords', async () => {
      workspaceState.setIndex(-1)
      workspaceState.setNavigatorRecords([])
      navigatorTreeDataProvider.refresh()

      await storeNavigatorRecord()
    }),
  )

  // Alternative Navigator records access via Quick Open modal
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.quickOpen', async () => {
      if (workspaceState.getNavigatorRecords().length === 0) return

      const index = workspaceState.getIndex()
      const navigatorRecords = workspaceState.getNavigatorRecords()
      const formattedPaths = formatPaths(navigatorRecords.map(record => record.uri.path))

      const activeThemeIcon = new vscode.ThemeIcon('circle-filled')
      const inactiveThemeIcon = new vscode.ThemeIcon('circle-outline')

      const selected = await vscode.window.showQuickPick(
        navigatorRecords
          .map((record, i) => ({
            label: formattedPaths.get(record.uri.path)!,
            description: `${record.selection.start.line + 1}: ${record.value}`,
            index: i,
            iconPath: i <= index ? activeThemeIcon : inactiveThemeIcon,
          }))
          .reverse()
      )
      if (!selected) return

      await jumpToRecord(selected.index)
    }),
  )

  // Used internally by the view
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.jumpToRecord', async (input?: { index?: number }) => {
      if (typeof input?.index === 'number') {
        await jumpToRecord(input.index)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.refresh', async () => {
      navigatorTreeDataProvider.refresh()
      await storeNavigatorRecord()
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => debouncedStoreNavigatorRecord()),
    // Note: delay IS REQUIRED here, without it the selection is always 0:0-0:0 initially
    vscode.window.onDidChangeActiveTextEditor(() => debouncedStoreNavigatorRecord())
  )

  storeNavigatorRecord()
}