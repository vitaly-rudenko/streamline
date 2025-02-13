import * as vscode from 'vscode'
import { extractWords } from './extract-words'
import { patterns } from './patterns'
import { escapeRegex } from '../../utils/escape-regex'

export function createSuperSearchFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  async function promptToSearch(input: { title: string; searchString: string; matchCase: boolean }) {
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
    ], { title: input.title })

    if (result === copySearchQuery) {
      await vscode.env.clipboard.writeText(input.searchString)
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
          query: input.searchString,
          isRegex: true,
          isCaseSensitive: input.matchCase,
          onlyOpenEditors: false,
          showIncludesExcludes: true,
          filesToInclude: currentlyOpenedFileRelativePath,
        })
      }
    } else if (result === findInAllOpenedFiles) {
      await vscode.commands.executeCommand('workbench.action.findInFiles', {
        query: input.searchString,
        isRegex: true,
        isCaseSensitive: input.matchCase,
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
          query: input.searchString,
          isRegex: true,
          isCaseSensitive: input.matchCase,
          onlyOpenEditors: false,
          showIncludesExcludes: true,
          filesToInclude: `./${currentWorkspaceFolder}`,
        })
      }
    } else if (result === findInAllWorkspaceFolders) {
      await vscode.commands.executeCommand('workbench.action.findInFiles', {
        query: input.searchString,
        isRegex: true,
        isCaseSensitive: input.matchCase,
        onlyOpenEditors: false,
        showIncludesExcludes: true,
        filesToInclude: '',
      })
    }
  }

  function generateSimilarMatchesRegex(input: {
    value: string
    allowHyphens: boolean
    allowUnderscores: boolean
    allowWhitespace: boolean
    matchCase: boolean
    matchWholeWord: boolean
    escapeRegex: boolean
  }) {
    // TODO: allow escaping whitespace
    const words = (input.value.includes(' ') ? input.value.split(' ') : extractWords(input.value)).map((word) => input.escapeRegex ? escapeRegex(word) : word)
    const split = [input.allowHyphens && '-', input.allowUnderscores && '_', input.allowWhitespace && '\\s'].filter(Boolean).join('')

    return {
      regex: `/${input.matchWholeWord ? '\\b' : ''}${words.join(split ? `[${split}]*` : '')}${input.matchWholeWord ? '\\b' : ''}/${input.matchCase ? '' : 'i'}`,
      searchString: `${input.matchWholeWord ? '\\b' : ''}${words.join(split ? `[${split}]*` : '')}${input.matchWholeWord ? '\\b' : ''}`,
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.superSearch.findSimilarMatches', async () => {
      const quickPick = vscode.window.createQuickPick()
      quickPick.canSelectMany = true

      const allowHyphensItem = { label: '$(circle-filled)', description: 'Allow hyphens (snake-case)', alwaysShow: true }
      const allowUnderscoresItem = { label: '$(circle-filled)', description: 'Allow underscores (kebab_case)', alwaysShow: true }
      const allowWhitespaceItem = { label: '$(whitespace)', alwaysShow: true, description: 'Allow whitespace' }
      const matchCaseItem = { label: '$(case-sensitive)', alwaysShow: true, description: 'Match case (case sensitive)' }
      const matchWholeWordItem = { label: '$(whole-word)', alwaysShow: true, description: 'Match whole word' }
      const escapeRegexItem = { label: '$(regex)', description: 'Escape input for regular expression', alwaysShow: true }

      quickPick.items = [
        allowHyphensItem,
        allowUnderscoresItem,
        allowWhitespaceItem,
        matchCaseItem,
        matchWholeWordItem,
        escapeRegexItem,
      ]
      quickPick.selectedItems = [allowHyphensItem, allowUnderscoresItem, matchWholeWordItem, escapeRegexItem]

      if (vscode.window.activeTextEditor) {
        if (vscode.window.activeTextEditor.selection.isSingleLine) {
          quickPick.value = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection)
        }
      }

      function getAllowHyphens() {
        return quickPick.selectedItems.some((item) => item.description === allowHyphensItem.description)
      }

      function getAllowUnderscores() {
        return quickPick.selectedItems.some((item) => item.description === allowUnderscoresItem.description)
      }

      function getAllowWhitespace() {
        return quickPick.selectedItems.some((item) => item.description === allowWhitespaceItem.description)
      }

      function getMatchCase() {
        return quickPick.selectedItems.some((item) => item.description === matchCaseItem.description)
      }

      function getMatchWholeWord() {
        return quickPick.selectedItems.some((item) => item.description === matchWholeWordItem.description)
      }

      function getEscapeRegex() {
        return quickPick.selectedItems.some((item) => item.description === escapeRegexItem.description)
      }

      function refresh() {
        quickPick.placeholder = 'Example: \'getEnabledFeatures()\' or \'get enabled features\''

        if (!quickPick.value.trim()) {
          quickPick.title = 'Start typing...'
          return
        }

        const { regex } = generateSimilarMatchesRegex({
          value: quickPick.value,
          allowHyphens: getAllowHyphens(),
          allowUnderscores: getAllowUnderscores(),
          allowWhitespace: getAllowWhitespace(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
        })

        quickPick.title = regex
      }

      quickPick.onDidChangeSelection(() => refresh())
      quickPick.onDidChangeValue(() => refresh())
      quickPick.onDidAccept(async () => {
        quickPick.dispose()

        const { regex, searchString } = generateSimilarMatchesRegex({
          value: quickPick.value,
          allowHyphens: getAllowHyphens(),
          allowUnderscores: getAllowUnderscores(),
          allowWhitespace: getAllowWhitespace(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
        })

        await promptToSearch({
          searchString,
          title: regex,
          matchCase: getMatchCase(),
        })
      })

      quickPick.show()
      refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.superSearch.findWords', async () => {
      const quickPick = vscode.window.createQuickPick()
      quickPick.canSelectMany = true

      const onSameLineItem = { label: '$(circle-filled)', description: 'Words must be on the same line', alwaysShow: true }
      const inProvidedOrderItem = { label: '$(circle-filled)', description: 'Words must appear in the provided order', alwaysShow: true }
      const matchAllNamingConventions = { label: '$(circle-filled)', description: 'Match words in all naming conventions', alwaysShow: true }
      const matchCaseItem = { label: '$(case-sensitive)', alwaysShow: true, description: 'Match case (case sensitive)' }
      const matchWholeWordItem = { label: '$(whole-word)', alwaysShow: true, description: 'Match whole word' }
      const escapeRegexItem = { label: '$(regex)', description: 'Escape input for regular expression', alwaysShow: true }

      quickPick.items = [
        onSameLineItem,
        inProvidedOrderItem,
        matchAllNamingConventions,
        matchCaseItem,
        matchWholeWordItem,
        escapeRegexItem,
      ]
      quickPick.selectedItems = [matchWholeWordItem, escapeRegexItem]

      function getOnSameLine() {
        return quickPick.selectedItems.some((item) => item.description === onSameLineItem.description)
      }

      function getInProvidedOrder() {
        return quickPick.selectedItems.some((item) => item.description === inProvidedOrderItem.description)
      }

      function getMatchAllNamingConventions() {
        return quickPick.selectedItems.some((item) => item.description === matchAllNamingConventions.description)
      }

      function getMatchCase() {
        return quickPick.selectedItems.some((item) => item.description === matchCaseItem.description)
      }

      function getMatchWholeWord() {
        return quickPick.selectedItems.some((item) => item.description === matchWholeWordItem.description)
      }

      function getEscapeRegex() {
        return quickPick.selectedItems.some((item) => item.description === escapeRegexItem.description)
      }

      // TODO: allow matching words in any naming convention
      function generateRegex(input: {
        value: string
        onSameLine: boolean
        inProvidedOrder: boolean
        matchAllNamingConventions: boolean
        matchCase: boolean
        matchWholeWord: boolean
        escapeRegex: boolean
      }) {
        // Allow escaping whitespace
        const words = input.value.split(' ')
          .map(word => input.escapeRegex ? escapeRegex(word) : word)
          .map(word => input.matchWholeWord ? `\\b${word}\\b` : word)
          .map(word => input.matchAllNamingConventions
              ? generateSimilarMatchesRegex({
                value: word,
                allowHyphens: true,
                allowUnderscores: true,
                allowWhitespace: false,
                matchCase: false,
                matchWholeWord: false,
                escapeRegex: false,
              }).searchString
              : word)

        const searchString = input.onSameLine
          ? input.inProvidedOrder
            ? patterns.findLinesWithAllWordsInProvidedOrder(words)
            : patterns.findLinesWithAllWordsInAnyOrder(words)
          : input.inProvidedOrder
            ? patterns.findFilesWithAllWordsInProvidedOrder(words)
            : patterns.findFilesWithAllWordsInAnyOrder(words)

        return {
          regex: `/${searchString}/${input.matchCase ? '' : 'i'}`,
          searchString,
        }
      }

      function refresh() {
        quickPick.placeholder = 'Example: \'cats dogs\''

        if (!quickPick.value.trim()) {
          quickPick.title = 'Start typing...'
          return
        }

        const { regex } = generateRegex({
          value: quickPick.value,
          onSameLine: getOnSameLine(),
          inProvidedOrder: getInProvidedOrder(),
          matchAllNamingConventions: getMatchAllNamingConventions(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
        })

        quickPick.title = regex
      }

      quickPick.onDidChangeSelection(() => refresh())
      quickPick.onDidChangeValue(() => refresh())
      quickPick.onDidAccept(async () => {
        quickPick.dispose()

        const { regex, searchString } = generateRegex({
          value: quickPick.value,
          onSameLine: getOnSameLine(),
          inProvidedOrder: getInProvidedOrder(),
          matchAllNamingConventions: getMatchAllNamingConventions(),
          matchCase: getMatchCase(),
          matchWholeWord: getMatchWholeWord(),
          escapeRegex: getEscapeRegex(),
        })

        await promptToSearch({
          searchString,
          title: regex,
          matchCase: getMatchCase(),
        })
      })

      quickPick.show()
      refresh()
    })
  )
}
