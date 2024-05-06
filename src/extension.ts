import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('streamline.helloWorld', async () => {
		const path = vscode.window.activeTextEditor?.document.uri;
		if (path?.scheme !== 'file') {
			return;
		}

		const relative = vscode.workspace.asRelativePath(path);
		const parts = relative.split('/');

		const options = Array.from(new Array(parts.length - 1), (_, i) => parts.slice(0, i + 1).join('/')).reverse();
		console.log(options);

		const option = await vscode.window.showQuickPick(options, { title: 'Select a folder to scope into' });

		const config = vscode.workspace.getConfiguration('files', null);
		const oldExcludes = config.get<{ [key: string]: boolean }>('exclude', {});

		const scopedFolders = Object.entries(oldExcludes).filter(([_, excluded]) => !excluded).map(([key]) => key);
		if (option) {
			scopedFolders.push(option);
		}

		const newExcludes = scopedFolders.reduce<{ [key: string]: boolean }>((res, folder) => {
			res[folder] = false;
			return res;
		}, {});

		const target = vscode.ConfigurationTarget.Workspace || null;
		await config.update('exclude', newExcludes, target);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

/*
{
    "$mid": 1,
    "fsPath": "/Users/vitaly/declutter-me/backend/app/Language.js",
    "external": "file:///Users/vitaly/declutter-me/backend/app/Language.js",
    "path": "/Users/vitaly/declutter-me/backend/app/Language.js",
    "scheme": "file"
}
*/

/*
{
    "$mid": 1,
    "fsPath": "Untitled-1",
    "external": "untitled:Untitled-1",
    "path": "Untitled-1",
    "scheme": "untitled"
}
*/