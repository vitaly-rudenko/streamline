import * as vscode from 'vscode'

class ThreadsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'streamline.threads'

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'threads.js')
    )

    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'threads.css')
    )

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link rel="stylesheet" href="${stylesUri}"></link>

				<title>Threads</title>
			</head>
			<body>
				<div class="mermaid">
          flowchart TD
          classDef suggestion font-size:10px,fill:#0000,stroke-dasharray:5 5
          classDef inactive font-size:10px,fill:#0000
          classDef active font-size:10px
          click 1 call handleNodeClick()
          1[process-data.js]:::active --> 2[delete-item.js]:::active
          click 2 call handleNodeClick()
          2[delete-item.js]:::active --> 3[get-item.js]:::active
          click 3 call handleNodeClick()
          3[get-item.js]:::active --> 4[update-item.js]:::inactive & 6[get-entry.js]:::active
          click 4 call handleNodeClick()
          4[update-item.js]:::active --> 5[products/process-item.js]:::inactive
          click 5 call handleNodeClick()
          5[products/process-item.js]:::inactive
          click 6 call handleNodeClick()
          6[get-entry.js]:::active --> 7[create-item.js]:::active
          click 7 call handleNodeClick()
          7[create-item.js]:::active --> 8[get-item.js]:::inactive & 12[users/get-entry.js]:::active
          click 8 call handleNodeClick()
          8[get-item.js]:::active --> 9[users/get-entry.js]:::inactive
          click 9 call handleNodeClick()
          9[users/get-entry.js]:::active --> 10[users/delete-record.js]:::inactive
          click 10 call handleNodeClick()
          10[users/delete-record.js]:::active --> 11[orders/create-entry.js]:::inactive
          click 11 call handleNodeClick()
          11[orders/create-entry.js]:::inactive
          click 12 call handleNodeClick()
          12[users/get-entry.js]:::active --> 13[users/delete-record.js]:::active
          click 13 call handleNodeClick()
          13[users/delete-record.js]:::active --> 14[orders/create-entry.js]:::active
          click 14 call handleNodeClick()
          14[orders/create-entry.js]:::active
          14[orders/create-entry.js]:::active -.-> 15[create-info.js]:::suggestion -.- 16[products/get-info.js]:::suggestion -.- 17[update-entry.js]:::suggestion
        </div>

				<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`
  }
}

export function createThreadsFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const threadsWebviewProvider = new ThreadsWebviewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'streamline.threads',
      threadsWebviewProvider
    )
  )
}
