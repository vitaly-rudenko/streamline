import * as vscode from 'vscode'
import * as os from 'os'
import { nouns } from './nouns'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'
import { ConditionContext, testWhen } from '../../common/when'
import { QuickReplConfig } from './quick-repl-config'
import path, { basename, dirname } from 'path'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { GenerateConditionContextInput, GenerateConditionContext } from '../../generate-condition-context'
import { QuickReplNotSetUpError, Template } from './common'
import { formatPath } from './utils'

// TODO: rename files/folders
// TODO: move files/folders
// TODO: somehow automatically focus on created file/folder in the tree view

export function createQuickReplFeature(input: {
  context: vscode.ExtensionContext
  generateConditionContext: GenerateConditionContext
}) {
  const { context, generateConditionContext } = input

  const config = new QuickReplConfig()
  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    quickReplTreeDataProvider.refresh()
    await updateContextInBackground()
  }, 500)

  const debouncedUpdateContextInBackground = createDebouncedFunction(async () => {
    await updateContextInBackground()
  }, 500)

  const quickReplTreeDataProvider = new QuickReplTreeDataProvider(config, isRunnable)
  const quickReplTreeView = vscode.window.createTreeView('quickRepl', {
    treeDataProvider: quickReplTreeDataProvider,
    showCollapseAll: true,
  })

  // Generate consistent terminal name for a given path
  function generateTerminalName(path: string) {
    const replsUri = config.getDynamicReplsUri()
    if (!replsUri) throw new QuickReplNotSetUpError()

    const shortPath = path.startsWith(replsUri.path)
      ? path.slice(replsUri.path.length + 1)
      : formatPath(path)

    return `Quick Repl: ${shortPath}`
  }

  // Whether file or folder is runnable (used in context and view)
  function isRunnable(input: GenerateConditionContextInput): boolean {
    const conditionContext = generateConditionContext(input)
    return config.getCommands()
      .some(command => !command.when || testWhen(conditionContext, command.when))
  }

  // Update context to show/hide "Run" command for active text editor
  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand(
        'setContext',
        'streamline.quickRepl.isActiveTextEditorRunnable',
        vscode.window.activeTextEditor && isRunnable(vscode.window.activeTextEditor)
      )
    } catch (error) {
      console.warn('[QuickRepl] Could not update context', error)
    }
  }

  function substitute(path: string, context?: { path?: string; content?: string; selection?: string }) {
    const replsUri = config.getDynamicReplsUri()
    if (!replsUri) throw new QuickReplNotSetUpError()

    let result = replaceShorthandWithHomedir(path)
    if (context?.path !== undefined) {
      result = result
        .replaceAll(/\b\$replsPath\b/g, replsUri.path)
        .replaceAll(/\b\$contextDirname\b/g, dirname(context.path))
        .replaceAll(/\b\$contextBasename\b/g, basename(context.path))
        .replaceAll(/\b\$contextPath\b/g, context.path)
    }

    if (context?.content !== undefined) {
      result = result.replaceAll(/\b\$contextContent\b/g, context.content)
    }

    if (context?.selection !== undefined) {
      result = result.replaceAll(/\b\$contextSelection\b/g, context.selection)
    }

    return result
      .replaceAll(/\b\$datetime\b/g, () => new Date().toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, ''))
      .replaceAll(/\b\$randomNoun\b/g, () => nouns[Math.floor(Math.random() * nouns.length)])
  }

  context.subscriptions.push(quickReplTreeView)

  // Runs selected command against File, Folder or Active Text Editor
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.run', async (argument: unknown) => {
      let conditionContext: ConditionContext
      let content: string | undefined
      let selection: string | undefined
      let uri: vscode.Uri

      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      if (
        argument instanceof FileTreeItem
        // Use Active Text Editor whenever possible
        && (activeTextEditorUri && argument.uri.path !== activeTextEditorUri.path)
      ) {
        uri = argument.uri
        content = (await vscode.workspace.fs.readFile(uri)).toString()
        conditionContext = generateConditionContext({ path: uri.path, fileType: vscode.FileType.File })
      } else if (
        argument instanceof FolderTreeItem
      ) {
        uri = argument.uri
        conditionContext = generateConditionContext({ path: uri.path, fileType: vscode.FileType.Directory })
      } else if (vscode.window.activeTextEditor) {
        uri = vscode.window.activeTextEditor.document.uri
        content = vscode.window.activeTextEditor.document.getText()
        selection = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection)
        conditionContext = generateConditionContext(vscode.window.activeTextEditor)

        // Save the file before running it, unless it's untitled (only active editor)
        if (!vscode.window.activeTextEditor.document.isUntitled) {
          await vscode.window.activeTextEditor.document.save()
        }
      } else {
        return
      }

      const context = { path: uri.path, content, selection }

      const commands = config.getCommands().filter(command => !command.when || testWhen(conditionContext, command.when))
      if (commands.length === 0) return

      const selected = commands.length === 1
        ? { command: commands[0] } // If only one command is available, run it immediately
        : await vscode.window.showQuickPick(
          commands.map(command => ({
            label: command.name,
            command,
          }))
        )
      if (!selected) return

      const { command } = selected

      const terminalName = generateTerminalName(uri.path)
      const terminal = vscode.window.terminals.find(t => t.name === terminalName)
        ?? vscode.window.createTerminal({
          name: terminalName,
          iconPath: new vscode.ThemeIcon('play'),
          cwd: substitute(command.cwd, context)
        })

      terminal.show(true)
      terminal.sendText(substitute(typeof command.command === 'string' ? command.command : command.command.join('\n'), context))
    })
  )

  // For Command Palette (Cmd+P)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.createQuickRepl', async () => {
      await startQuickReplWizard({ parentUri: undefined })
    })
  )

  // TODO: It only shows Quick Repl templates at the moment, does not allow creating files or folders
  // For "+" button in the tree view title
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.createInRoot', async () => {
      const replsUri = config.getDynamicReplsUri()
      if (!replsUri) throw new QuickReplNotSetUpError()

      await vscode.commands.executeCommand('streamline.quickRepl.create', replsUri)
    })
  )

  // For files and folders in the tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.create', async (argument: unknown) => {
      const parentUri = argument instanceof FolderTreeItem ? argument.uri
        : argument instanceof vscode.Uri ? argument
          : undefined
      if (!parentUri) return

      const selected = await vscode.window.showQuickPick([
        { label: 'Create Quick Repl', iconPath: new vscode.ThemeIcon('file-code'), option: 'createQuickRepl' },
        { label: 'Create File', iconPath: new vscode.ThemeIcon('new-file'), option: 'createFile' },
        { label: 'Create Folder', iconPath: new vscode.ThemeIcon('new-folder'), option: 'createDirectory' },
      ] as const)
      if (!selected) return

      const { option } = selected

      if (option === 'createQuickRepl') {
        await startQuickReplWizard({ parentUri: parentUri })
      }

      if (option === 'createFile') {
        const basename = await vscode.window.showInputBox({ title: 'Enter file name' })
        if (!basename) return

        const fileUri = vscode.Uri.joinPath(parentUri, basename)
        await vscode.workspace.fs.writeFile(fileUri, new Uint8Array())
        await vscode.window.showTextDocument(fileUri)
        // TODO: reveal file

        quickReplTreeDataProvider.refresh()
      }

      if (option === 'createDirectory') {
        const basename = await vscode.window.showInputBox({ title: 'Enter folder name' })
        if (!basename) return

        const directoryUri = vscode.Uri.joinPath(parentUri, basename)
        await vscode.workspace.fs.createDirectory(directoryUri)
        // TODO: reveal directory

        quickReplTreeDataProvider.refresh()
      }
    })
  )

  async function readTemplateContent(template: Template['template']) {
    if (!template) return undefined

    if ('content' in template) {
      return Array.isArray(template.content) ? template.content.join('\n') : template.content
    }

    if ('path' in template) {
      const templateUri = vscode.Uri.file(substitute(template.path))

      try {
        return (await vscode.workspace.fs.readFile(templateUri)).toString()
      } catch (error) {
        // TODO: warning
        console.warn('[QuickRepl] Could not read file template content', error)
        return undefined
      }
    }

    throw new Error('Invalid template')
  }

  async function startQuickReplWizard(input: { parentUri: vscode.Uri | undefined }) {
    const replsUri = config.getDynamicReplsUri()
    if (!replsUri) throw new QuickReplNotSetUpError()

    const templates = config.getTemplates()
    if (templates.length === 0) {
      await vscode.window.showInformationMessage('You don\'t have any templates yet')
      return
    }

    const selectedTemplate = await vscode.window.showQuickPick(
      templates.map(template => ({
        label: template.name,
        description: template.type,
        detail: template.description,
        iconPath: template.type === 'file'
          ? new vscode.ThemeIcon('new-file')
          : new vscode.ThemeIcon('new-folder'),
        template
      }))
    )
    if (!selectedTemplate) return

    const { template } = selectedTemplate

    if (template.type === 'snippet') {
      const document = await vscode.workspace.openTextDocument({
        content: await readTemplateContent(template.template),
        language: template.languageId,
      })

      await vscode.window.showTextDocument(document)
    }

    if (template.type === 'file') {
      const defaultPath = template.defaultPath ? substitute(template.defaultPath) : undefined

      const defaultBasename = defaultPath ? path.basename(defaultPath) : undefined
      const defaultDirectory = input.parentUri
        ? path.dirname(input.parentUri.path)
        : defaultPath
          ? path.dirname(defaultPath)
          : undefined

      const basename = await vscode.window.showInputBox({
        title: 'Enter file name',
        value: defaultBasename,
      })
      if (!basename) return

      const templateContent = await readTemplateContent(template.template)

      const fileUri = vscode.Uri.joinPath(defaultDirectory ? vscode.Uri.file(defaultDirectory) : replsUri, basename)
      await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(templateContent))
      await vscode.window.showTextDocument(fileUri)
      // TODO: reveal file
    }

    if (template.type === 'directory') {
      const defaultPath = template.defaultPath ? substitute(template.defaultPath) : undefined
      const defaultBasename = defaultPath ? path.basename(defaultPath) : undefined
      const defaultDirectory = input.parentUri
        ? path.dirname(input.parentUri.path)
        : defaultPath
          ? path.dirname(defaultPath)
          : undefined

      const basename = await vscode.window.showInputBox({
        title: 'Enter file name',
        value: defaultBasename,
      })
      if (!basename) return

      const templateDirectoryUri = vscode.Uri.file(substitute(template.template.path))

      const directoryUri = vscode.Uri.joinPath(defaultDirectory ? vscode.Uri.file(defaultDirectory) : replsUri, basename)
      await vscode.workspace.fs.copy(templateDirectoryUri, directoryUri, { overwrite: false })

      if (template.template.fileToOpen) {
        const fileToOpenUri = vscode.Uri.joinPath(directoryUri, template.template.fileToOpen)
        await vscode.window.showTextDocument(fileToOpenUri)
        // TODO: reveal file
      } else {
        // TODO: reveal directory
      }
    }

    quickReplTreeDataProvider.refresh()
  }

  // Delete file or folder
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

  // Refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.refresh', async () => {
      quickReplTreeDataProvider.refresh()
    })
  )

  // Setup wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.setup', async () => {
      // TODO:
    })
  )

  // Open Repls folder in a new VS Code window
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openReplsInNewWindow', async () => {
      const replsUri = config.getDynamicReplsUri()
      if (!replsUri) throw new QuickReplNotSetUpError()

      await vscode.commands.executeCommand('vscode.openFolder', replsUri, { forceNewWindow: true })
    })
  )

  // Reveal Repls folder in OS
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealReplsInOS', async () => {
      const replsUri = config.getDynamicReplsUri()
      if (!replsUri) throw new QuickReplNotSetUpError()

      await vscode.commands.executeCommand('revealFileInOS', replsUri)
    })
  )

  // Open specific file or folder in a new VS Code window
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openInNewWindow', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.commands.executeCommand('vscode.openFolder', argument.uri, { forceNewWindow: true })
      }
    })
  )

  // Reveal specific file or folder in OS
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.revealInOS', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.commands.executeCommand('revealFileInOS', argument.uri)
      }
    })
  )

  // Copy file's or folder's absolute path to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.copyAbsolutePath', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        await vscode.env.clipboard.writeText(argument.uri.path)
      }
    })
  )

  // Open folder in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.openFolderInTerminal', async (argument: unknown) => {
      if (argument instanceof FolderTreeItem) {
        const terminalName = generateTerminalName(argument.uri.path)
        const terminal = vscode.window.createTerminal({
          name: terminalName,
          iconPath: new vscode.ThemeIcon('play'),
          cwd: argument.uri,
        })

        terminal.show()
      }
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
    // TODO: Not triggered when file language changes (manually or by VS Code)
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    vscode.window.onDidChangeTextEditorOptions(() => updateContextInBackground()),
    // Slower refresh rate to avoid performance issues
    vscode.window.onDidChangeTextEditorSelection(() => debouncedUpdateContextInBackground()),
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
