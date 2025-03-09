import * as vscode from 'vscode'
import * as os from 'os'
import jsonBeautify from 'json-beautify'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'
import { ConditionContext, testWhen } from '../../common/when'
import { QuickReplConfig } from './quick-repl-config'
import path, { basename, dirname } from 'path'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { GenerateConditionContextInput, GenerateConditionContext } from '../../generate-condition-context'
import { QuickReplNotSetUpError, Template } from './common'
import { setupCommands, setupReplsPath, setupTemplates } from './setup'
import { waitUntil } from '../../utils/wait-until'
import { QuickReplDragAndDropController } from './quick-repl-drag-and-drop-controller'
import { substitute } from './toolkit/substitute'
import { expandHomedir } from '../../utils/expand-homedir'
import { collapseHomedir } from '../../utils/collapse-homedir'
import { RegisterCommand } from '../../register-command'

// TODO: Somehow automatically reveal created file/directory in the Quick Repl view
// TODO: CHANGELOG & README

export function createQuickReplFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  generateConditionContext: GenerateConditionContext
}) {
  const { context, registerCommand, generateConditionContext } = input

  const homedir = os.homedir()

  const config = new QuickReplConfig()
  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    quickReplTreeDataProvider.refresh()
    await updateContextInBackground()
  }, 500)

  const scheduleUpdateContextInBackground = createDebouncedFunction(async () => {
    await updateContextInBackground()
  }, 500)

  const quickReplTreeDataProvider = new QuickReplTreeDataProvider(config, isRunnable, homedir)
  const quickReplTreeView = vscode.window.createTreeView('quickRepl', {
    treeDataProvider: quickReplTreeDataProvider,
    dragAndDropController: new QuickReplDragAndDropController(config, quickReplTreeDataProvider, homedir),
    showCollapseAll: true,
    canSelectMany: true,
  })

  function getReplsPathOrFail() {
    const shortReplsPath = config.getShortReplsPath()
    if (!shortReplsPath) throw new QuickReplNotSetUpError()
    return expandHomedir(shortReplsPath, homedir)
  }

  // Generate consistent terminal name for a given path
  function generateTerminalName(context: { path: string }) {
    return substitute({
      input: '$contextBasename',
      replsPath: getReplsPathOrFail(),
      context,
      homedir,
    })
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

  context.subscriptions.push(quickReplTreeView)

  // Runs selected command against File, Folder or Active Text Editor
  registerCommand('streamline.quickRepl.run', async (argument: unknown) => {
    let conditionContext: ConditionContext
    let content: string | undefined
    let selection: string | undefined
    let uri: vscode.Uri

    console.debug('streamline.quickRepl.run', { argument })

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

    console.debug('streamline.quickRepl.run', { context })

    const commands = config.getCommands().filter(command => !command.when || testWhen(conditionContext, command.when))

    console.debug('streamline.quickRepl.run', { commands })

    if (commands.length === 0) return

    // If only one command is available or if there is a matched default command, run it immediately
    const defaultCommand = (commands.length === 1 && !commands[0].confirm)
      ? commands[0]
      : commands.find(command => command.default)

    console.debug('streamline.quickRepl.run', { defaultCommand })

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

    console.debug('streamline.quickRepl.run', { command })

    const terminalName = generateTerminalName({ path: uri.path })
    const terminalIconPath = new vscode.ThemeIcon('play')
    const terminalColor = new vscode.ThemeColor('terminal.ansiBlue')
    const terminalCwd = substitute({
      input: expandHomedir(command.cwd, homedir),
      replsPath: getReplsPathOrFail(),
      context,
      homedir,
    })

    console.debug('streamline.quickRepl.run', { terminalName, terminalCwd, terminalIconPath, terminalColor })

    const existingTerminal = vscode.window.terminals
      .find(t => (
        t.creationOptions.name === terminalName
        && (t.creationOptions.iconPath instanceof vscode.ThemeIcon && t.creationOptions.iconPath.id === terminalIconPath.id)
        && (t.creationOptions.color instanceof vscode.ThemeColor && t.creationOptions.color.id === terminalColor.id)
        && t.shellIntegration?.cwd?.path === terminalCwd
      ))

    const terminal = existingTerminal ?? vscode.window.createTerminal({
      name: terminalName,
      cwd: terminalCwd,
      color: terminalColor,
      iconPath: terminalIconPath,
    })

    terminal.show(true)
    terminal.sendText(
      substitute({
        input: typeof command.command === 'string'
          ? command.command
          : command.command.join('\n'),
        replsPath: getReplsPathOrFail(),
        context,
        homedir,
      })
    )

    console.debug('streamline.quickRepl.run', { terminal })
  })

  // For Command Palette (Cmd+P)
  registerCommand('streamline.quickRepl.createQuickRepl', async () => {
    await startQuickReplWizard({ parentUri: undefined })
  })

  // For "+" button in the tree view title
  registerCommand('streamline.quickRepl.createInRoot', async () => {
    await vscode.commands.executeCommand('streamline.quickRepl.create', vscode.Uri.file(getReplsPathOrFail()))
  })

  // For files and folders in the tree view
  registerCommand('streamline.quickRepl.create', async (argument: unknown) => {
    const parentUri = argument instanceof FolderTreeItem
      ? argument.uri
      : argument instanceof vscode.Uri
        ? argument
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
      await startQuickReplWizard({ parentUri })
    }

    if (option === 'createFile') {
      const basename = await vscode.window.showInputBox({ title: 'Enter file name' })
      if (!basename) return

      const fileUri = vscode.Uri.joinPath(parentUri, basename)
      await vscode.workspace.fs.writeFile(fileUri, new Uint8Array())
      await vscode.window.showTextDocument(fileUri)

      quickReplTreeDataProvider.refresh()
    }

    if (option === 'createDirectory') {
      const basename = await vscode.window.showInputBox({ title: 'Enter folder name' })
      if (!basename) return

      const directoryUri = vscode.Uri.joinPath(parentUri, basename)
      await vscode.workspace.fs.createDirectory(directoryUri)

      quickReplTreeDataProvider.refresh()
    }
  })

  async function readTemplateContent(template: Template['template']) {
    if (!template) return undefined

    if ('content' in template) {
      return Array.isArray(template.content) ? template.content.join('\n') : template.content
    }

    if ('path' in template) {
      const templateUri = vscode.Uri.file(
        substitute({
          input: expandHomedir(template.path, homedir),
          replsPath: getReplsPathOrFail(),
          homedir,
        })
      )

      try {
        return (await vscode.workspace.fs.readFile(templateUri)).toString()
      } catch (error) {
        console.warn(`[QuickRepl] Failed to read template: ${template.path}`, error)
        vscode.window.showWarningMessage(`Failed to read template: ${template.path}`)
        return undefined
      }
    }

    throw new Error('Invalid template')
  }

  async function startQuickReplWizard(input: { parentUri: vscode.Uri | undefined }) {
    const replsUri = vscode.Uri.file(getReplsPathOrFail())

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
      const defaultPath = template.defaultPath
        ? substitute({
          input: expandHomedir(template.defaultPath, homedir),
          replsPath: getReplsPathOrFail(),
          homedir,
        })
        : undefined

      const defaultBasename = defaultPath ? path.basename(defaultPath) : undefined
      const defaultDirectory = input.parentUri
        ? input.parentUri.path
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
    }

    if (template.type === 'directory') {
      const defaultPath = template.defaultPath
        ? substitute({
          input: expandHomedir(template.defaultPath, homedir),
          replsPath: getReplsPathOrFail(),
          homedir,
        })
        : undefined

      const defaultBasename = defaultPath ? path.basename(defaultPath) : undefined
      const defaultDirectory = input.parentUri
        ? input.parentUri.path
        : defaultPath
          ? path.dirname(defaultPath)
          : undefined

      const basename = await vscode.window.showInputBox({
        title: 'Enter file name',
        value: defaultBasename,
      })
      if (!basename) return

      const templateDirectoryUri = vscode.Uri.file(
        substitute({
          input: expandHomedir(template.template.path, homedir),
          replsPath: getReplsPathOrFail(),
          homedir,
        })
      )

      const directoryUri = vscode.Uri.joinPath(defaultDirectory ? vscode.Uri.file(defaultDirectory) : replsUri, basename)
      await vscode.workspace.fs.copy(templateDirectoryUri, directoryUri, { overwrite: false })

      if (template.template.fileToOpen) {
        const fileToOpenUri = vscode.Uri.joinPath(directoryUri, substitute({
          input: expandHomedir(template.template.fileToOpen, homedir),
          replsPath: getReplsPathOrFail(),
          context: { path: directoryUri.path },
          homedir,
        }))

        await vscode.window.showTextDocument(fileToOpenUri)
      }
    }

    quickReplTreeDataProvider.refresh()
  }

  // Delete file or folder
  registerCommand('streamline.quickRepl.delete', async (arg: unknown, alernativeArg: unknown) => {
    const args = Array.isArray(alernativeArg) ? alernativeArg : [arg]
    const treeItems = args.filter(arg => arg instanceof FileTreeItem || arg instanceof FolderTreeItem)
    if (treeItems.length === 0) return

    const firstLabel = `"${treeItems[0].label ?? basename(treeItems[0].uri.path)}"`
    const label = treeItems.length > 1 ? `${firstLabel} and ${treeItems.length - 1} more files` : firstLabel
    const confirmed = await vscode.window.showInformationMessage(`Are you sure you want to delete ${label}?`, 'Yes, delete', 'Cancel')
    if (confirmed !== 'Yes, delete') return

    for (const item of treeItems) {
      try {
        await vscode.workspace.fs.delete(item.uri, { recursive: true, useTrash: true })
      } catch (error) {
        console.warn(`[QuickRepl] Failed to delete ${item.uri.path}`, error)
        vscode.window.showWarningMessage(`Failed to delete ${item.uri.path}`)
      }
    }

    quickReplTreeDataProvider.refresh()
  })

  // Refresh tree view
  registerCommand('streamline.quickRepl.refresh', async () => {
    quickReplTreeDataProvider.refresh()
  })

  // Start setup wizard
  registerCommand('streamline.quickRepl.setup', async () => {
    const currentShortReplsPath = config.getShortReplsPath()

    // Step 1: Quick Repls path
    const selectedReplsPath = await vscode.window.showQuickPick([
      ...currentShortReplsPath
        ? [{ label: 'Keep current Quick Repls folder', detail: currentShortReplsPath, iconPath: new vscode.ThemeIcon('folder-active'), option: 'keepCurrent' }]
        : [],
      ...!currentShortReplsPath || currentShortReplsPath !== setupReplsPath
        ? [{ label: 'Use default folder for Quick Repls', detail: setupReplsPath, iconPath: new vscode.ThemeIcon('folder-library'), option: 'useDefault' }]
        : [],
      { label: 'Pick custom folder...', iconPath: new vscode.ThemeIcon('folder-opened'), option: 'selectCustom' },
    ] as const, {
      placeHolder: 'Select folder for storing your Quick Repls',
    })
    if (!selectedReplsPath) return

    const { option } = selectedReplsPath
    let shortReplsPath: string
    if (option === 'keepCurrent') {
      shortReplsPath = currentShortReplsPath ?? setupReplsPath
    } else if (option === 'useDefault') {
      shortReplsPath = setupReplsPath
    } else {
      const replsUri = await vscode.window.showOpenDialog({
        openLabel: 'Select folder for your Quick Repls',
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      })
      if (!replsUri) return

      shortReplsPath = replsUri[0].path
    }

    await vscode.workspace.fs.createDirectory(
      vscode.Uri.file(expandHomedir(shortReplsPath, homedir))
    )

    config.setShortReplsPath(collapseHomedir(shortReplsPath, homedir))
    quickReplTreeDataProvider.refresh()
    await config.save()

    vscode.window.showInformationMessage(`Your Quick Repls will now be stored in ${shortReplsPath}`)

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

    if (
      await vscode.window.showInformationMessage(
        'You\'re all set. Enjoy using Quick Repl!',
        'Try creating a Quick Repl now',
      )
    ) {
      await vscode.commands.executeCommand('streamline.quickRepl.createQuickRepl')
    }
  })

  // Open Repls folder in a new VS Code window
  registerCommand('streamline.quickRepl.openReplsInNewWindow', async () => {
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(getReplsPathOrFail()), { forceNewWindow: true })
  })

  // Reveal Repls folder in OS
  registerCommand('streamline.quickRepl.revealReplsInOS', async () => {
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(getReplsPathOrFail()))
  })

  // Open specific file or folder in a new VS Code window
  registerCommand('streamline.quickRepl.openInNewWindow', async (argument: unknown) => {
    if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
      await vscode.commands.executeCommand('vscode.openFolder', argument.uri, { forceNewWindow: true })
    }
  })

  // Reveal specific file or folder in OS
  registerCommand('streamline.quickRepl.revealInOS', async (argument: unknown) => {
    if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
      await vscode.commands.executeCommand('revealFileInOS', argument.uri)
    }
  })

  // Duplicate file or folder
  registerCommand('streamline.quickRepl.duplicate', async (argument: unknown) => {
    if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
      const originalBasename = basename(argument.uri.path)
      const copyBasename = await vscode.window.showInputBox({
        placeHolder: originalBasename,
        value: originalBasename,
      })
      if (!copyBasename) return
      if (copyBasename === originalBasename) {
        vscode.window.showWarningMessage('Please provide a different name')
        await vscode.commands.executeCommand('streamline.quickRepl.duplicate', argument)
        return
      }

      const directoryUri = vscode.Uri.file(dirname(argument.uri.path))
      await vscode.workspace.fs.copy(argument.uri, vscode.Uri.joinPath(directoryUri, copyBasename), { overwrite: false })

      quickReplTreeDataProvider.refresh()
    }
  })

  // Rename file or folder
  registerCommand('streamline.quickRepl.rename', async (argument: unknown) => {
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

  // Copy file's or folder's absolute path to clipboard
  registerCommand('streamline.quickRepl.copyAbsolutePath', async (argument: unknown) => {
    if (argument instanceof FileTreeItem || argument instanceof FolderTreeItem) {
      await vscode.env.clipboard.writeText(argument.uri.path)
    }
  })

  // Open folder in terminal
  registerCommand('streamline.quickRepl.openFolderInTerminal', async (argument: unknown) => {
    if (argument instanceof FolderTreeItem) {
      const terminalName = generateTerminalName({ path: argument.uri.path })
      const terminal = vscode.window.createTerminal({
        name: terminalName,
        iconPath: new vscode.ThemeIcon('play'),
        cwd: argument.uri,
      })

      terminal.show()
    }
  })

  // Create template from a folder
  registerCommand('streamline.quickRepl.createTemplateFromFolder', async (argument: unknown) => {
    if (argument instanceof FolderTreeItem) {
      const templateName = await vscode.window.showInputBox({
        value: basename(argument.uri.path),
        placeHolder: 'Enter template name',
      })
      if (!templateName) return

      if (config.getTemplates().some(template => template.name === templateName)) {
        vscode.window.showWarningMessage(`Template with name "${templateName}" already exists`)
        await vscode.commands.executeCommand('streamline.quickRepl.createTemplateFromFolder', argument)
        return
      }

      const replsPath = getReplsPathOrFail()
      const templatePath = argument.uri.path
      const templateTemplatePath = templatePath.startsWith(replsPath + '/')
        ? ('$replsPath' + templatePath.slice(replsPath.length))
        : templatePath

      const template: Template = {
        name: templateName,
        type: 'directory',
        defaultPath: '$replsPath/$datetime_$randomAdjective_$randomNoun',
        template: {
          path: templateTemplatePath,
        }
      }

      config.setTemplates([...config.getTemplates(), template])
      await config.save()

      vscode.window.showInformationMessage(`Template "${templateName}" has been created`)
    }
  })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.quickRepl')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    // Note: Not triggered when file language changes (manually or by VS Code)
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    vscode.window.onDidChangeTextEditorOptions(() => updateContextInBackground()),
    // Slower refresh rate to avoid performance issues
    vscode.window.onDidChangeTextEditorSelection(() => scheduleUpdateContextInBackground()),
  )

  updateContextInBackground()
}
