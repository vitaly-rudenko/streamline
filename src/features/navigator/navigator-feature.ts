import { basename } from 'path'
import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { NavigatorTreeDataProvider } from './navigator-tree-data-provider'

export type Record = {
  uri: vscode.Uri
  selection: vscode.Selection
  value: string
}

export function formatRecord(record: Record) {
  return basename(record.uri.path) + ':' + (record.selection.start.line + 1) + ':' + (record.selection.start.character + 1)
}

// TODO: how untitled / dirty files are handled?

export function createNavigatorFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const navigatorTreeDataProvider = new NavigatorTreeDataProvider()
  context.subscriptions.push(vscode.window.registerTreeDataProvider('navigator', navigatorTreeDataProvider))

  function createRecord() {
    const activeTextEditor = vscode.window.activeTextEditor
    if (!activeTextEditor) return

    const record = {
      uri: activeTextEditor.document.uri,
      selection: activeTextEditor.selection,
      value: activeTextEditor.document.lineAt(activeTextEditor.selection.start.line).text,
    }

    return record
  }

  function storeRecord() {
    try {
      const record = createRecord()
      if (!record) return

      if (navigatorTreeDataProvider.records[navigatorTreeDataProvider.index] && isSameRecord(record, navigatorTreeDataProvider.records[navigatorTreeDataProvider.index])) {
        return
      }

      if (navigatorTreeDataProvider.records[navigatorTreeDataProvider.index + 1] && isSameRecord(record, navigatorTreeDataProvider.records[navigatorTreeDataProvider.index + 1])) {
        navigatorTreeDataProvider.index++
        return
      }

      navigatorTreeDataProvider.records = navigatorTreeDataProvider.records
        .slice(0, navigatorTreeDataProvider.index + 1)
        .slice(-100) // store latest 100 records

      navigatorTreeDataProvider.records.push(record)
      navigatorTreeDataProvider.index++

      if (navigatorTreeDataProvider.index < 0 || navigatorTreeDataProvider.index >= navigatorTreeDataProvider.records.length) {
        throw new Error('Invalid navigator index')
      }
    } catch (error) {
      console.log(error)
    }
  }

  async function goToIndex(i: number) {
    if (navigatorTreeDataProvider.index === i) return

    navigatorTreeDataProvider.index = i
    const record = navigatorTreeDataProvider.records[i]
    await vscode.commands.executeCommand('vscode.open', record.uri, { selection: record.selection })
    navigatorTreeDataProvider.refresh()
  }

  function isSameRecord(record1: Record, record2: Record) {
    return record1.uri.path === record2.uri.path
      && record1.selection.start.line === record2.selection.start.line
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.navigator.prevFile', async () => {
      if (navigatorTreeDataProvider.index > 0) {
        const prevIndex = navigatorTreeDataProvider.records.findLastIndex(
          (record, i) => i < navigatorTreeDataProvider.index && record.uri.path !== navigatorTreeDataProvider.records[navigatorTreeDataProvider.index].uri.path
        )
        await goToIndex(prevIndex === -1 ? 0 : prevIndex)
      }
    }),
    vscode.commands.registerCommand('streamline.navigator.prevSelection', async () => {
      if (navigatorTreeDataProvider.index > 0) {
        await goToIndex(navigatorTreeDataProvider.index - 1)
      }
    }),
    vscode.commands.registerCommand('streamline.navigator.nextSelection', async () => {
      if (navigatorTreeDataProvider.index < navigatorTreeDataProvider.records.length - 1) {
        await goToIndex(navigatorTreeDataProvider.index + 1)
      }
    }),
    vscode.commands.registerCommand('streamline.navigator.nextFile', async () => {
      if (navigatorTreeDataProvider.index < navigatorTreeDataProvider.records.length - 1) {
        const nextIndex = navigatorTreeDataProvider.records.findIndex(
          (record, i) => i > navigatorTreeDataProvider.index && record.uri.path !== navigatorTreeDataProvider.records[navigatorTreeDataProvider.index].uri.path
        )

        await goToIndex(nextIndex === -1 ? navigatorTreeDataProvider.records.length - 1 : nextIndex)
      }
    }),
    vscode.commands.registerCommand('streamline.navigator.clear', async () => {
      navigatorTreeDataProvider.index = -1
      navigatorTreeDataProvider.records = []
    }),
    vscode.commands.registerCommand('streamline.navigator.quickOpen', async () => {
      if (navigatorTreeDataProvider.records.length === 0) return
      const selected = await vscode.window.showQuickPick(
        navigatorTreeDataProvider.records.map((record, i) => ({
          label: `${i === navigatorTreeDataProvider.index ? '>' : ' '} ${i}: ${formatRecord(record)}`,
          index: i,
        })).reverse()
      )
      if (!selected) return
      goToIndex(selected.index)
    }),
    vscode.commands.registerCommand('streamline.navigator.goToIndex', async (index: number) => {
      goToIndex(index)
    })
  )

  function smartStoreRecord() {
    const currentRecord = navigatorTreeDataProvider.records[navigatorTreeDataProvider.index]
    if (
      currentRecord &&
      currentRecord.uri.path === vscode.window.activeTextEditor?.document.uri.path &&
      Math.abs(currentRecord.selection.start.line - vscode.window.activeTextEditor.selection.start.line) <= 25
    ) {
      const record = createRecord()
      if (record) {
        navigatorTreeDataProvider.records[navigatorTreeDataProvider.index] = record
        console.log('Replaced')
      } else {
        console.log('Ignored')
      }

      navigatorTreeDataProvider.refresh()
      return
    }

    storeRecord()
    navigatorTreeDataProvider.refresh()
  }

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => {
      // Timeout is NOT required here, but used as a small "debouncing" technique
      setTimeout(() => {
        smartStoreRecord()
      }, 100)
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      // Note: timeout IS REQUIRED here, without it the selection is always 0:0-0:0 initially
      setTimeout(() => {
        smartStoreRecord()
      }, 100)
    })
  )

  storeRecord()
  navigatorTreeDataProvider.refresh()
}