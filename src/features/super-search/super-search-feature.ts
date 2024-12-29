import * as vscode from 'vscode'
import { extractWords } from './extract-words'
import { PatternOptions, patterns, PatternType } from './patterns'
import { SuperSearchViewProvider } from './super-search-view-provider';

// TODO: feature: search presets
// TODO: feature: find current file name (e.g. imports, usage, definition, etc)
// TODO: feature: pattern builder (setup max search result length, max lines/context length, etc)

export function createSuperSearchFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

	const superSearchViewProvider = new SuperSearchViewProvider(context.extensionUri)
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('streamline.superSearch.view', superSearchViewProvider))

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.superSearch.quickOpen', async () => {
      const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { patternType: PatternType }>()
      quickPick.matchOnDescription = true

      const wholeWordButton = { iconPath: new vscode.ThemeIcon('whole-word') }

      quickPick.onDidChangeValue((input) => {
        const words = input.includes(' ')
          ? input.split(' ').filter(Boolean)
          : extractWords(input)

        if (words.length === 0) {
          quickPick.items = []
          return
        }

        quickPick.items = [
          {
            patternType: 'findInAllNamingConventions',
            detail: patterns.findInAllNamingConventions(words),
            label: 'Search by different naming conventions',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('case-sensitive'),
          },
          {
            patternType: 'findLinesWithAllWordsInProvidedOrder',
            detail: patterns.findLinesWithAllWordsInProvidedOrder(words),
            label: 'Find lines containing all words in provided order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('selection'),
            buttons: [wholeWordButton],
          },
          {
            patternType: 'findLinesWithAllWordsInAnyOrder',
            detail: patterns.findLinesWithAllWordsInAnyOrder(words),
            label: 'Find lines containing all words in any order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('selection'),
            buttons: [wholeWordButton],
          },
          {
            patternType: 'findFilesWithAllWordsInProvidedOrder',
            detail: patterns.findFilesWithAllWordsInProvidedOrder(words),
            label: 'Find files containing all words in provided order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('files'),
            buttons: [wholeWordButton],
          },
          {
            patternType: 'findFilesWithAllWordsInAnyOrder',
            detail: patterns.findFilesWithAllWordsInAnyOrder(words),
            label: 'Find files containing all words in any order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('files'),
            buttons: [wholeWordButton],
          }
        ]
      })

      quickPick.onDidTriggerItemButton(async (event) => {
        if (event.button === wholeWordButton) {
          await triggerSearch(event.item.patternType, { wholeWord: true })
        }
      })

      quickPick.onDidAccept(async () => {
        const item = quickPick.activeItems[0]
        if (!item) return

        await triggerSearch(item.patternType, { wholeWord: false })
      })

      async function triggerSearch(patternType: PatternType, options: PatternOptions) {
        const words = quickPick.value.includes(' ')
          ? quickPick.value.split(' ').filter(Boolean)
          : extractWords(quickPick.value)
        if (words.length === 0) return

        const pattern = patterns[patternType](words, options)

        await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: pattern,
            isRegex: true,
            triggerSearch: true,
            matchWholeWord: false,
            isCaseSensitive: false,
        })
      }

      quickPick.items = []
      quickPick.show()
    })
  )
}
