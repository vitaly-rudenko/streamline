import * as vscode from 'vscode'
import * as os from 'os'
import { nouns } from './nouns'
import { FileTreeItem, FolderTreeItem, QuickReplTreeDataProvider } from './quick-repl-tree-data-provider'

// TODO: Configurable "main" folder
// TODO: "Supported" extensions and configurable commands for each extension / folder
// TODO: Move between folders / drag-n-drop?
// TODO: Open in a new VS Code window

export function createQuickReplFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const quickReplTreeDataProvider = new QuickReplTreeDataProvider()
  const quickReplTreeView = vscode.window.createTreeView('quickRepl', {
    treeDataProvider: quickReplTreeDataProvider,
    showCollapseAll: true,
  })

  async function updateContextInBackground() {
    try {
      const activeTextEditor = vscode.window.activeTextEditor
      const home = os.homedir()

      await vscode.commands.executeCommand(
        'setContext',
        'streamline.quickRepl.isCurrentFileRunnable',
        activeTextEditor && (activeTextEditor.document.isUntitled || activeTextEditor.document.uri.path.startsWith(`${home}/.streamline/quick-repl/repls/`))
      )
    } catch (error) {
      console.warn('[QuickRepl] Could not update context', error)
    }
  }

  context.subscriptions.push(quickReplTreeView)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.quickRepl.runFile', async (fileTreeItem: FileTreeItem | undefined) => {
      let uri: vscode.Uri | undefined
      if (fileTreeItem === undefined) {
        let activeTextEditor = vscode.window.activeTextEditor
        if (!activeTextEditor) return

        const home = os.homedir()

        // Save untitled file
        if (activeTextEditor.document.isUntitled) {
          const directoryPath = `${home}/.streamline/quick-repl/repls/untitled`
          const filename = `${new Date().toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, '')}_${nouns[Math.floor(Math.random() * nouns.length)]}.mjs`
          const fileUri = vscode.Uri.file(`${directoryPath}/${filename}`)

          // Prevent saving into existing file if random name is not random enough
          await vscode.workspace.fs.stat(fileUri)
            .then(
              () => { throw new Error('File already exists, please try again') },
              () => { }, // file doesn't exist, all good
            )

          // TODO: allow user to pick folder for repls (setting)
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(directoryPath))

          const data = new TextEncoder().encode(activeTextEditor.document.getText())
          await vscode.workspace.fs.writeFile(fileUri, data)

          await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor')

          activeTextEditor = await vscode.window.showTextDocument(fileUri, { preview: false })

          quickReplTreeDataProvider.refresh()
        }

        // Save dirty file
        if (activeTextEditor.document.isDirty) {
          await activeTextEditor.document.save()
        }

        uri = activeTextEditor.document.uri
      } else if (fileTreeItem instanceof FileTreeItem) {
        uri = fileTreeItem.uri
      }

      if (!uri) return

      const pathParts = uri.path.split('/')
      const filename = pathParts.pop()
      const directoryPath = pathParts.join('/')

      // TODO: consistent and non-annoying way of reusing terminals
      //       perhaps by their current cwd and if there's no process running at the moment
      const terminalName = `QuickRepl: ${filename}`
      const terminal = vscode.window.terminals.find(t => t.name === terminalName)
        ?? vscode.window.createTerminal({
          name: terminalName,
          iconPath: new vscode.ThemeIcon('play'),
          cwd: vscode.Uri.file(directoryPath),
        })

      terminal.show()
      terminal.sendText(`node ${filename}`)
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