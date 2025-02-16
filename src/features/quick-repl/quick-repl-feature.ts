import * as vscode from 'vscode'
import * as os from 'os'
import { nouns } from './nouns'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'
import { ConditionContext, testWhen } from '../../common/when'
import { QuickReplConfig } from './quick-repl-config'
import { basename, dirname } from 'path'

// TODO: Move between folders / drag-n-drop?
// TODO: Open in a new VS Code window

export function createQuickReplFeature(input: {
  context: vscode.ExtensionContext
  generateConditionContextForActiveTextEditor: () => ConditionContext
}) {
  const { context, generateConditionContextForActiveTextEditor } = input

  const config = new QuickReplConfig()

  const quickReplTreeDataProvider = new QuickReplTreeDataProvider()
  const quickReplTreeView = vscode.window.createTreeView('quickRepl', {
    treeDataProvider: quickReplTreeDataProvider,
    showCollapseAll: true,
  })

  function generateConditionContextForPath(path: string): ConditionContext {
    return {
      ...generateConditionContextForActiveTextEditor(),
      path,
      languageId: undefined,
      untitled: false,
    }
  }

  function isCurrentFileRunnable() {
    const conditionContext = generateConditionContextForActiveTextEditor()
    return config.getCommands()
      .some(command => !command.when || testWhen(conditionContext, command.when))
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand(
        'setContext',
        'streamline.quickRepl.isCurrentFileRunnable',
        vscode.window.activeTextEditor && isCurrentFileRunnable()
      )
    } catch (error) {
      console.warn('[QuickRepl] Could not update context', error)
    }
  }

  context.subscriptions.push(quickReplTreeView)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.runFile', async (argument: unknown) => {
      let conditionContext: ConditionContext
      let fileContent: string
      let uri: vscode.Uri

      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      if (
        argument instanceof FileTreeItem
        && (activeTextEditorUri && argument.uri.path !== activeTextEditorUri.path) // reuse existing editor if possible
      ) {
        uri = argument.uri
        fileContent = (await vscode.workspace.fs.readFile(uri)).toString()
        conditionContext = generateConditionContextForPath(uri.path)
      } else if (vscode.window.activeTextEditor) {
        uri = vscode.window.activeTextEditor.document.uri
        fileContent = vscode.window.activeTextEditor.document.getText()
        conditionContext = generateConditionContextForActiveTextEditor()
      } else {
        return
      }

      const variables = {
        replsPath: replaceShorthandWithHomedir(config.getReplsPath()),
        datetime: new Date().toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, ''),
        randomNoun: nouns[Math.floor(Math.random() * nouns.length)],
        filePath: uri.path,
        fileBasename: basename(uri.path),
        fileDirectory: dirname(uri.path),
        fileContent,
      }

      const commands = config.getCommands().filter(command => !command.when || testWhen(conditionContext, command.when))
      if (commands.length === 0) return

      const selected = commands.length === 1
        ? { command: commands[0] }
        : await vscode.window.showQuickPick(
          commands.map(command => ({
            label: command.name,
            command,
          }))
        )
      if (!selected) return

      const { command } = selected

      const shortPath = uri.path.startsWith(variables.replsPath)
        ? uri.path.slice(variables.replsPath.length + 1)
        : replaceHomeWithShorthand(uri.path)
      const terminalName = `QuickRepl: ${shortPath}`
      const terminal = vscode.window.terminals.find(t => t.name === terminalName)
        ?? vscode.window.createTerminal({
          name: terminalName,
          iconPath: new vscode.ThemeIcon('play'),
          cwd: replaceShorthandWithHomedir(replaceVariables(command.cwd, variables)),
        })

      terminal.show()
      terminal.sendText(
        replaceVariables(
          typeof command.command === 'string'
            ? command.command
            : command.command.join('\n'),
          variables
        )
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealReplsInOS', async () => {
      const home = os.homedir()
      const replsUri = vscode.Uri.file(`${home}/.streamline/quick-repl/repls`)

      await vscode.commands.executeCommand('revealFileInOS', replsUri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealFileInOS', async (treeItem: FileTreeItem | FolderTreeItem) => {
      await vscode.commands.executeCommand('revealFileInOS', treeItem.uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.copyAbsolutePath', async (treeItem: FileTreeItem | FolderTreeItem) => {
      await vscode.env.clipboard.writeText(treeItem.uri.fsPath)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.delete', async (treeItem: FileTreeItem | FolderTreeItem) => {
      await vscode.workspace.fs.delete(treeItem.uri, {
        recursive: true,
        useTrash: true,
      })

      quickReplTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.refresh', async () => {
      quickReplTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openFolderInTerminal', async (folderTreeItem: FolderTreeItem) => {
      // TODO: reuse existing terminal (find a way to reliably find such terminals)
      const terminal = vscode.window.createTerminal({
        iconPath: new vscode.ThemeIcon('play'),
        cwd: folderTreeItem.uri,
      })

      terminal.show()
    })
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateContextInBackground()
    }),
  )

  updateContextInBackground()
}

function replaceShorthandWithHomedir(path: string) {
  return path.replace(/^~\//, `${os.homedir()}/`)
}

function replaceHomeWithShorthand(path: string) {
  return path.startsWith(os.homedir() + '/')
    ? `~/${path.slice(os.homedir().length + 1)}`
    : path
}

function replaceVariables(input: string, variables: Record<string, string>) {
  let result = input
  for (const [variable, value] of Object.entries(variables)) {
    result = result.replaceAll(`$${variable}`, value)
  }
  return result
}
