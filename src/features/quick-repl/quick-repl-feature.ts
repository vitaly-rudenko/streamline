import * as vscode from 'vscode'
import * as os from 'os'
import jsonBeautify from 'json-beautify'
import { nouns } from './nouns'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'
import { ConditionContext, testWhen } from '../../common/when'
import { QuickReplConfig } from './quick-repl-config'
import path, { basename, dirname } from 'path'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { GenerateConditionContextInput, GenerateConditionContext } from '../../generate-condition-context'
import { QuickReplNotSetUpError, Template } from './common'
import { formatPath } from './utils'
import { setupCommands, setupReplsPath, setupTemplates } from './setup'
import { waitUntil } from '../../utils/wait-until'
import { QuickReplDragAndDropController } from './quick-repl-drag-and-drop-controller'

// TODO: somehow automatically focus on created file/folder in the tree view
// TODO: CHANGELOG & README
// TODO: documentation (quick-repl.md) + make it accessible with command "Quick Repl: Help"

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
    dragAndDropController: new QuickReplDragAndDropController(config, quickReplTreeDataProvider),
    showCollapseAll: true,
  })

  // Generate consistent terminal name for a given path
  function generateTerminalName(path: string) {
    const replsUri = config.getDynamicReplsUri()
    if (!replsUri) throw new QuickReplNotSetUpError()

    const contextShortPath = path.startsWith(replsUri.path)
      ? path.slice(replsUri.path.length + 1)
      : formatPath(path)

    return substitute(config.getTerminalName(), { path }, { contextShortPath })
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

  function substitute(path: string, context?: { path?: string; content?: string; selection?: string }, additionalVariables?: Record<string, string>) {
    const replsUri = config.getDynamicReplsUri()
    if (!replsUri) throw new QuickReplNotSetUpError()

    let result = replaceShorthandWithHomedir(path)
      .replaceAll('$replsPath', replsUri.path)

    if (context?.path !== undefined) {
      result = result
        .replaceAll('$contextDirname', dirname(context.path))
        .replaceAll('$contextBasename', basename(context.path))
        .replaceAll('$contextPath', context.path)
    }

    if (additionalVariables) {
      for (const [key, value] of Object.entries(additionalVariables)) {
        result = result.replaceAll(`$${key}`, value)
      }
    }

    if (context?.content !== undefined) {
      result = result.replaceAll('$contextContent', context.content)
    }

    if (context?.selection !== undefined) {
      result = result.replaceAll('$contextSelection', context.selection)
    }

    return result
      .replaceAll('$datetime', () => new Date().toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, ''))
      .replaceAll('$randomNoun', () => nouns[Math.floor(Math.random() * nouns.length)])
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

      // If only one command is available or if there is a matched default command, run it immediately
      const defaultCommand = commands.length === 1 ? commands[0] : commands.find(command => command.default)

      const selected = defaultCommand
        ? { command: defaultCommand } 
        : await vscode.window.showQuickPick(
          commands.map(command => ({
            label: command.name,
            description: command.description,
            detail: `${command.cwd}: ${Array.isArray(command.command) ? command.command.join(' \n ') : command.command}`,
            command,
            iconPath: new vscode.ThemeIcon('play'),
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
      vscode.window.showInformationMessage('You don\'t have any templates yet')
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
      // Step 1: Quick Repls path
      const selectedReplsPath = await vscode.window.showQuickPick([
        ...config.getReplsPath()
          ? [{ label: 'Keep current Quick Repls folder', detail: config.getReplsPath(), iconPath: new vscode.ThemeIcon('folder-active'),  option: 'keepCurrent' }]
          : [],
        ...!config.getReplsPath() || config.getReplsPath() !== setupReplsPath
          ? [{ label: 'Use default folder for Quick Repls', detail: setupReplsPath, iconPath: new vscode.ThemeIcon('folder-library'),  option: 'useDefault' }]
          : [],
        { label: 'Pick custom folder...', iconPath: new vscode.ThemeIcon('folder-opened'),  option: 'selectCustom' },
      ] as const, {
        placeHolder: 'Select folder for storing your Quick Repls',
      })
      if (!selectedReplsPath) return

      const { option } = selectedReplsPath
      let replsPath: string
      if (option === 'keepCurrent') {
        replsPath = config.getReplsPath()!
      } else if (option === 'useDefault') {
        replsPath = setupReplsPath
      } else {
        const replsUri = await vscode.window.showOpenDialog({
          openLabel: 'Select folder for your Quick Repls',
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
        })
        if (!replsUri) return

        replsPath = replsUri[0].path
      }

      await vscode.workspace.fs.createDirectory(vscode.Uri.file(replaceShorthandWithHomedir(replsPath)))

      config.setReplsPath(replaceHomeWithShorthand(replsPath))
      quickReplTreeDataProvider.refresh()
      await config.save()

      vscode.window.showInformationMessage(`Your Quick Repls will now be stored in ${replsPath}`)

      // Step 2: Templates
      let shouldSetupTemplates = config.getTemplates().length === 0
      if (config.getTemplates().length > 0) {
        const selectedSetupTemplates = await vscode.window.showQuickPick([
          { label: 'Keep current templates', detail: `You have ${config.getTemplates().length} templates`, iconPath: new vscode.ThemeIcon('check'), option: 'keepCurrent' },
          { label: 'Setup default templates', detail: 'Your existing templates will be replaced', iconPath: new vscode.ThemeIcon('replace-all'), option: 'setupDefault' },
        ], {
          placeHolder: 'You already have templates, do you want to replace them?'
        })
        if (!selectedSetupTemplates) return

        shouldSetupTemplates = selectedSetupTemplates.option === 'setupDefault'
      }

      if (shouldSetupTemplates) {
        const templatesEditor = await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({
            content: [
              '# Quick Repl',
              '',
              '## Templates',
              '',
              'Templates allow you to quickly create scripts and projects in your Quick Repls folder.',
              'You can manage them in VS Code settings via `streamline.quickRepl.templates`.',
              'For more information, see: https://github.com/vitaly-rudenko/streamline/blob/main/docs/quick-repl.md',
              '',
              '**Close this file to save these templates and continue the setup.**',
              '',
              '### Examples',
              '',
              '```json',
              jsonBeautify(setupTemplates, null as any, 2, 100),
              '```',
            ].join('\n'),
            language: 'markdown',
          })
        )
        await waitUntil(() => templatesEditor.document.isClosed)

        config.setTemplates(setupTemplates)
        await config.save()

        vscode.window.showInformationMessage('Default templates have been added to your settings')
      }

      // Step 3: Commands
      let shouldSetupCommands = config.getCommands().length === 0
      if (config.getCommands().length > 0) {
        const selectedSetupCommands = await vscode.window.showQuickPick([
          { label: 'Keep current commands', detail: `You have ${config.getCommands().length} commands`, iconPath: new vscode.ThemeIcon('check'), option: 'keepCurrent' },
          { label: 'Setup default commands', detail: 'Your existing commands will be replaced', iconPath: new vscode.ThemeIcon('replace-all'), option: 'setupDefault' },
        ], {
          placeHolder: 'You already have commands, do you want to replace them?'
        })
        if (!selectedSetupCommands) return

        shouldSetupCommands = selectedSetupCommands.option === 'setupDefault'
      }

      if (shouldSetupCommands) {
        const commandsEditor = await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({
            content: [
              '# Quick Repl',
              '',
              '## Commands',
              '',
              'Commands allow you run snippets, files and folders depending on the context.',
              'You can modify them in VS Code settings via `streamline.quickRepl.commands`.',
              'For more information, see: https://github.com/vitaly-rudenko/streamline/blob/main/docs/quick-repl.md',
              '',
              '**Close this file to save these commands and continue the setup.**',
              '',
              '### Examples',
              '',
              '```json',
              jsonBeautify(setupCommands, null as any, 2, 100),
              '```',
            ].join('\n'),
            language: 'markdown',
          })
        )
        await waitUntil(() => commandsEditor.document.isClosed)

        config.setCommands(setupCommands)
        await config.save()

        vscode.window.showInformationMessage('Default commands have been added to your settings')
      }

      const selectedFinalStep = await vscode.window.showQuickPick([
        { label: 'Try creating a Quick Repl', iconPath: new vscode.ThemeIcon('rocket'), option: 'createQuickRepl' },
        { label: 'I\'ll explore on my own', iconPath: new vscode.ThemeIcon('eye'), option: 'finish' },
      ], {
        placeHolder: 'You\'re all set! What would you like to do next?'
      })

      if (selectedFinalStep?.option === 'createQuickRepl') {
        await vscode.commands.executeCommand('streamline.quickRepl.createQuickRepl')
      }
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

  // Rename file or folder
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.rename', async (argument: unknown) => {
      if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
        const newBasename = await vscode.window.showInputBox({
          placeHolder: basename(argument.uri.path),
          value: basename(argument.uri.path),
        })
        if (!newBasename) return

        const directoryUri = vscode.Uri.file(dirname(argument.uri.path))
        await vscode.workspace.fs.rename(argument.uri, vscode.Uri.joinPath(directoryUri, newBasename))

        quickReplTreeDataProvider.refresh()
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
