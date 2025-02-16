import * as vscode from 'vscode'
import * as os from 'os'
import { nouns } from './nouns'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'
import { ConditionContext, testWhen } from '../../common/when'
import { QuickReplConfig } from './quick-repl-config'
import { basename, dirname } from 'path'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

// TODO: Move between folders / drag-n-drop?
// TODO: Open in a new VS Code window

export function createQuickReplFeature(input: {
  context: vscode.ExtensionContext
  generateConditionContextForActiveTextEditor: () => ConditionContext
}) {
  const { context, generateConditionContextForActiveTextEditor } = input

  const config = new QuickReplConfig()
  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    quickReplTreeDataProvider.refresh()
    await updateContextInBackground()
  }, 500)

  const debouncedUpdateContextInBackground = createDebouncedFunction(async () => {
    await updateContextInBackground()
  }, 500)

  const quickReplTreeDataProvider = new QuickReplTreeDataProvider(config, generateConditionContextForPath)
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

  function isActiveTextEditorRunnable() {
    const conditionContext = generateConditionContextForActiveTextEditor()
    return config.getCommands()
      .some(command => !command.when || testWhen(conditionContext, command.when))
  }

  // TODO: should not be here, since config may change at any moment
  const replsPath = replaceShorthandWithHomedir(config.getReplsPath())
  const replsUri = vscode.Uri.file(replsPath)

  function generateVariables() {
    return {
      replsPath,
      datetime: new Date().toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, ''),
      randomNoun: nouns[Math.floor(Math.random() * nouns.length)],
    }
  }

  function laxPathToUri(path: string, variables?: Record<string, string>) {
    return vscode.Uri.file(
      replaceVariables(
        replaceShorthandWithHomedir(path),
        { ...generateVariables(), ...variables }
      )
    )
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand(
        'setContext',
        'streamline.quickRepl.isActiveTextEditorRunnable',
        vscode.window.activeTextEditor && isActiveTextEditorRunnable()
      )
    } catch (error) {
      console.warn('[QuickRepl] Could not update context', error)
    }
  }

  context.subscriptions.push(quickReplTreeView)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.run', async (argument: unknown) => {
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

      const shortPath = uri.path.startsWith(replsPath)
        ? uri.path.slice(replsPath.length + 1)
        : laxPathToUri(uri.path).path
      const terminalName = `QuickRepl: ${shortPath}`
      const terminal = vscode.window.terminals.find(t => t.name === terminalName)
        ?? vscode.window.createTerminal({
          name: terminalName,
          iconPath: new vscode.ThemeIcon('play'),
          cwd: laxPathToUri(command.cwd, variables),
        })

      terminal.show(true)
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
    vscode.commands.registerCommand('streamline.quickRepl.openReplsInNewWindow', async () => {
      await vscode.commands.executeCommand('vscode.openFolder', replsUri, { forceNewWindow: true })
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealReplsInOS', async () => {
      await vscode.commands.executeCommand('revealFileInOS', replsUri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openInNewWindow', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.commands.executeCommand('vscode.openFolder', argument.uri, { forceNewWindow: true })
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealInOS', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.commands.executeCommand('revealFileInOS', argument.uri)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.copyAbsolutePath', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.env.clipboard.writeText(argument.uri.path)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.createInRoot', async () => {
      await vscode.commands.executeCommand('streamline.quickRepl.create')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.create', async (argument: unknown) => {
      let parentUri: vscode.Uri
      if (argument instanceof FolderTreeItem) {
        parentUri = argument.uri
      } else {
        parentUri = replsUri
      }

      // TODO: template.defaultPath

      const selected = await vscode.window.showQuickPick(
        [
          { label: 'Create Quick Repl', iconPath: new vscode.ThemeIcon('file-code'), option: 'quickRepl' },
          { label: 'Create File', iconPath: new vscode.ThemeIcon('new-file'), option: 'file' },
          { label: 'Create Folder', iconPath: new vscode.ThemeIcon('new-folder'), option: 'directory' },
        ] as const
      )
      if (!selected) return

      let type: 'file' | 'directory'
      let basename: string | undefined
      let templateTemplate: { path: string } | { content: string } | undefined

      if (selected.option === 'quickRepl') {
        const templates = config.getTemplates()
        if (templates.length === 0) {
          await vscode.window.showInformationMessage('You don\'t have any templates yet')
          return
        }

        const selectedTemplate = await vscode.window.showQuickPick(
          templates.map(template => ({
            label: template.name,
            description: template.type,
            iconPath: template.type === 'file'
              ? new vscode.ThemeIcon('new-file')
              : new vscode.ThemeIcon('new-folder'),
            template
          }))
        )
        if (!selectedTemplate) return

        const { template } = selectedTemplate

        const defaultName = replaceVariables(template.defaultName, generateVariables())
        basename = await vscode.window.showInputBox({
          title: template.type === 'file'
          ? 'Enter file name'
          : 'Enter directory name',
          value: defaultName,
        })

        type = template.type
        templateTemplate = template.template
      } else {
        basename = await vscode.window.showInputBox({
          title: selected.option === 'file'
            ? 'Enter file name'
            : 'Enter directory name',
        })

        type = selected.option
      }

      if (!basename) return

      const uri = vscode.Uri.joinPath(parentUri, basename)
      if (type === 'file')  {
        let content: string = ''
        if (templateTemplate) {
          if ('content' in templateTemplate) {
            content = templateTemplate.content
          } else {
            content = (await vscode.workspace.fs.readFile(laxPathToUri(templateTemplate.path))).toString()
          }
        }

        const encoder = new TextEncoder()
        await vscode.workspace.fs.writeFile(uri, encoder.encode(content))

        await vscode.window.showTextDocument(uri)
      } else {
        if (templateTemplate) {
          if ('path' in templateTemplate) {
            await vscode.workspace.fs.copy(
              laxPathToUri(templateTemplate.path),
              uri,
              { overwrite: false }
            )
          } else {
            throw new Error('Content template is not supported for directories')
          }
        } else {
          await vscode.workspace.fs.createDirectory(uri)
        }
      }

      quickReplTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.delete', async (argument) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        const confirmed = await vscode.window.showInformationMessage(`Are you sure you want to delete "${argument.label}"?`, 'Yes, delete', 'Cancel')
        if (confirmed !== 'Yes, delete') return

        await vscode.workspace.fs.delete(argument.uri, {
          recursive: true,
          useTrash: true,
        })

        quickReplTreeDataProvider.refresh()
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.refresh', async () => {
      quickReplTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openFolderInTerminal', async (argument: unknown) => {
      if (argument instanceof FolderTreeItem) {
        // TODO: reuse existing terminal (find a way to reliably find such terminals)
        const terminal = vscode.window.createTerminal({
          iconPath: new vscode.ThemeIcon('play'),
          cwd: argument.uri,
        })

        terminal.show()
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.setupReplsPath', async () => {
      await vscode.workspace.fs.createDirectory(replsUri)
      quickReplTreeDataProvider.refresh()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.quickRepl')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    // TODO: Not very reliable, specifically when changing / auto-detecting file language
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    vscode.window.onDidChangeTextEditorOptions(() => updateContextInBackground()),
    vscode.workspace.onDidChangeTextDocument(() => debouncedUpdateContextInBackground()),
  )

  updateContextInBackground()
}

export function replaceShorthandWithHomedir(path: string) {
  return path.replace(/^~\//, `${os.homedir()}/`)
}

export function replaceHomeWithShorthand(path: string) {
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
