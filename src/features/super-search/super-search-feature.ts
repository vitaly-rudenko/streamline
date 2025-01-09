import * as vscode from 'vscode'
import { extractWords } from './extract-words'
import { PatternOptions, patterns, PatternType } from './patterns'
import { escapeRegex } from '../../utils/escape-regex'

export function createSuperSearchFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.superSearch.findSimilarMatches', async () => {
      const quickPick = vscode.window.createQuickPick()
      quickPick.canSelectMany = true

      const allowHyphensItem = { label: '-', description: 'Allow hyphens (snake-case)', alwaysShow: true }
      const allowUnderscoresItem = { label: '_', description: 'Allow underscores (kebab_case)', alwaysShow: true }
      const allowWhitespaceItem = { label: '$(whitespace)', alwaysShow: true, description: 'Allow whitespace' }
      const matchCaseItem = { label: '$(case-sensitive)', alwaysShow: true, description: 'Match case' }
      const matchWholeWordItem = { label: '$(whole-word)', alwaysShow: true, description: 'Match whole word' }
      const escapeRegexItem = { label: '$(regex)', description: 'Escape input', alwaysShow: true }
      const useCommaDelimiterItem = { label: '$(edit)', description: 'Use comma to separate words', alwaysShow: true }

      quickPick.items = [
        allowHyphensItem,
        allowUnderscoresItem,
        allowWhitespaceItem,
        matchCaseItem,
        matchWholeWordItem,
        escapeRegexItem,
        useCommaDelimiterItem,
      ]
      quickPick.selectedItems = [allowHyphensItem, allowUnderscoresItem, escapeRegexItem]

      if (vscode.window.activeTextEditor) {
        if (vscode.window.activeTextEditor.selection.isSingleLine) {
          quickPick.value = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection)
        }
      }

      function getAllowHyphens() {
        return quickPick.selectedItems.some((item) => item.label === allowHyphensItem.label)
      }

      function getAllowUnderscores() {
        return quickPick.selectedItems.some((item) => item.label === allowUnderscoresItem.label)
      }

      function getAllowWhitespace() {
        return quickPick.selectedItems.some((item) => item.label === allowWhitespaceItem.label)
      }

      function getMatchCase() {
        return quickPick.selectedItems.some((item) => item.label === matchCaseItem.label)
      }

      function getMatchWholeWord() {
        return quickPick.selectedItems.some((item) => item.label === matchWholeWordItem.label)
      }

      function getEscapeRegex() {
        return quickPick.selectedItems.some((item) => item.label === escapeRegexItem.label)
      }

      function getUseCommaDelimiter() {
        return quickPick.selectedItems.some((item) => item.label === useCommaDelimiterItem.label)
      }

      function generateRegex(input: {
        value: string
        allowHyphens: boolean
        allowUnderscores: boolean
        allowWhitespace: boolean
        matchCase: boolean
        matchWholeWord: boolean
        escapeRegex: boolean
        useCommaDelimiter: boolean
      }) {
        const delimiter = input.useCommaDelimiter ? ',' : ' '
        const words = (input.value.includes(delimiter) ? input.value.split(delimiter) : extractWords(input.value)).map((word) => input.escapeRegex ? escapeRegex(word) : word)
        const split = [input.allowHyphens && '-', input.allowUnderscores && '_', input.allowWhitespace && '\\s'].filter(Boolean).join('')

        return {
          regex: `/${input.matchWholeWord ? '\\b' : ''}${words.join(split ? `[${split}]?` : '')}${input.matchWholeWord ? '\\b' : ''}/${input.matchCase ? '' : 'i'}`,
          searchString: `${input.matchWholeWord ? '\\b' : ''}${words.join(split ? `[${split}]?` : '')}${input.matchWholeWord ? '\\b' : ''}`,
        }
      }

      function refresh() {
        quickPick.placeholder = getUseCommaDelimiter()
          ? 'Example: \'getEnabledFeatures()\' or \'get,enabled,features\''
          : 'Example: \'getEnabledFeatures()\' or \'get enabled features\''

        if (!quickPick.value.trim()) {
          quickPick.title = 'Start typing...'
          return
        }

        const { regex } = generateRegex({
          value: quickPick.value,
          allowHyphens: getAllowHyphens(),
          allowUnderscores: getAllowUnderscores(),
          allowWhitespace: getAllowWhitespace(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
          useCommaDelimiter: getUseCommaDelimiter(),
        })

        quickPick.title = regex
      }

      quickPick.onDidChangeSelection(() => refresh())
      quickPick.onDidChangeValue(() => refresh())
      quickPick.onDidAccept(async () => {
        const { regex, searchString } = generateRegex({
          value: quickPick.value,
          allowHyphens: getAllowHyphens(),
          allowUnderscores: getAllowUnderscores(),
          allowWhitespace: getAllowWhitespace(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
          useCommaDelimiter: getUseCommaDelimiter(),
        })

        const copySearchQuery = '$(copy) Copy search query'
        const findInCurrentlyOpenedFile = '$(file) Find in currently opened file'
        const findInAllOpenedFiles = '$(files) Find in all opened files'
        const findInCurrentWorkspaceFolder = '$(file-directory) Find in current workspace folder'
        const findInAllWorkspaceFolders = '$(file-submodule) Find in all workspace folders'

        const result = await vscode.window.showQuickPick([
          findInCurrentlyOpenedFile,
          findInAllOpenedFiles,
          findInCurrentWorkspaceFolder,
          findInAllWorkspaceFolders,
          copySearchQuery,
        ], { title: regex })

        // TODO: toggle escaping regex
        // TODO: escape whitespace to allow typing it as a character

        if (result === copySearchQuery) {
          await vscode.env.clipboard.writeText(searchString)
        } else if (result === findInCurrentlyOpenedFile) {
          // TODO: buggy, sometimes opens with current selection instead of specified searchString
          // await vscode.commands.executeCommand('editor.actions.findWithArgs', {
          //   searchString,
          //   isRegex: true,
          //   isCaseSensitive: getMatchCase(),
          // })

          const currentlyOpenedFilePath = vscode.window.activeTextEditor?.document.uri.path
          const currentlyOpenedFileRelativePath = currentlyOpenedFilePath ? vscode.workspace.asRelativePath(currentlyOpenedFilePath, true) : undefined
          if (currentlyOpenedFileRelativePath) {
            await vscode.commands.executeCommand('workbench.action.findInFiles', {
              query: searchString,
              isRegex: true,
              isCaseSensitive: getMatchCase(),
              onlyOpenEditors: false,
              showIncludesExcludes: true,
              filesToInclude: currentlyOpenedFileRelativePath,
            })
          }
        } else if (result === findInAllOpenedFiles) {
          await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: searchString,
            isRegex: true,
            isCaseSensitive: getMatchCase(),
            onlyOpenEditors: true,
            showIncludesExcludes: true,
            filesToInclude: '',
          })
        } else if (result === findInCurrentWorkspaceFolder) {
          const currentlyOpenedFilePath = vscode.window.activeTextEditor?.document.uri.path
          const currentlyOpenedFileRelativePath = currentlyOpenedFilePath ? vscode.workspace.asRelativePath(currentlyOpenedFilePath, true) : undefined
          if (currentlyOpenedFileRelativePath && currentlyOpenedFileRelativePath !== currentlyOpenedFilePath) {
            const currentWorkspaceFolder = currentlyOpenedFileRelativePath.split('/')[0]
            await vscode.commands.executeCommand('workbench.action.findInFiles', {
              query: searchString,
              isRegex: true,
              isCaseSensitive: getMatchCase(),
              onlyOpenEditors: false,
              showIncludesExcludes: true,
              filesToInclude: `./${currentWorkspaceFolder}`,
            })
          }
        } else if (result === findInAllWorkspaceFolders) {
          await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: searchString,
            isRegex: true,
            isCaseSensitive: getMatchCase(),
            onlyOpenEditors: false,
            showIncludesExcludes: true,
            filesToInclude: '',
          })
        }

        quickPick.dispose()
      })

      quickPick.show()
      refresh()
    })
  )

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
