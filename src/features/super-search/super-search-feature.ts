import * as vscode from 'vscode'
import { extractWords } from './extract-words'

// TODO: feature: search presets
// TODO: feature: find current file name (e.g. imports, usage, definition, etc)
// TODO: feature: find file/line that contains multiple words

export function createSuperSearchFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.superSearch.quickOpen', async () => {
      const quickPick = vscode.window.createQuickPick()
      quickPick.matchOnDescription = true

      quickPick.onDidChangeValue((input) => {
        const words = extractWords(input)

        if (words.length === 0) {
          quickPick.items = []
          return
        }

        quickPick.items = [
          {
            detail: words.join('[-_]?'),
            label: 'Search by different naming conventions',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('case-sensitive'),
          },
          {
            // TODO: escape word in regex, improve regex
            // TODO: correct regex
            detail: words.join('.*'),
            label: 'Find lines containing all words in provided order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('selection'),
          },
          {
            // TODO: escape word in regex, improve regex
            detail: `^${words.map(word => `(?=[\\s\\S]*(${word}))`).join('')}[\\s\\S]*$`,
            label: 'Find lines containing all words in any order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('selection'),
          },
          {
            // TODO: escape word in regex, improve regex
            // TODO: correct regex
            detail: words.join('.*'),
            label: 'Find files containing all words in provided order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('files'),
          },
          {
            // TODO: escape word in regex, improve regex
            detail: `^${words.map(word => `(?=[\\s\\S\\n]*(${word}))`).join('')}[\\s\\S\\n]*$`,
            label: 'Find files containing all words in any order',
            alwaysShow: true,
            iconPath: new vscode.ThemeIcon('files'),
          }
        ]
      })

      quickPick.onDidAccept(async () => {
        const item = quickPick.activeItems[0]
        if (!item) return

        await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: item.detail,
            isRegex: true,
            triggerSearch: true,
            matchWholeWord: false,
            isCaseSensitive: false,
        })
      })

      quickPick.items = []
      quickPick.show()
    })
  )
}
