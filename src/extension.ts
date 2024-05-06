import * as vscode from 'vscode';
import { generateExcludedPaths } from './generate-excluded-paths';
import { serializeExcludes } from './serialize-excludes';
import { unique } from './unique';

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scope', async () => {
			await setIsScoped(true);
			await updateExcludes();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.unscope', async () => {
			await setIsScoped(false);
			await updateExcludes();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.toggle-scope-for-file', async (file: vscode.Uri) => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === file.path);
			const path = workspaceFolder
				? workspaceFolder.name + '/'
				:	vscode.workspace.asRelativePath(file) + ((await vscode.workspace.fs.stat(file)).type === vscode.FileType.Directory ? '/' : '');

			console.log(`Adding ${path} to scopedPaths`);

			const config = vscode.workspace.getConfiguration("streamline");
			const scopedPaths = config.get('scopedPaths', []) as string[];

			if (scopedPaths.includes(path)) {
				await config.update('scopedPaths', scopedPaths.filter(scopedPaths => scopedPaths !== path));
			} else {
				await config.update('scopedPaths', [...scopedPaths, path]);
			}

			await updateExcludes();
		})
	);

	await refreshContext();
	await updateExcludes();
}

async function updateExcludes() {
	if (await getIsScoped()) {
		await setExcludes(vscode.workspace.getConfiguration('streamline').get('scopedPaths', []));
	} else {
		await setExcludes([]);
	}
}

async function setExcludes(includedPaths: string[]) {
	const config = vscode.workspace.getConfiguration('files', null);

	const excludedPaths = await generateExcludedPaths(includedPaths, readDirectory);
	// TODO: VS Code doesn't support excluding files in a specific workspace folder using workspace configuration.
	//       See https://github.com/microsoft/vscode/issues/82145.
	const excludedPathsWithoutWorkspaceFolder = unique(
		excludedPaths
			.map(excludedPath => excludedPath.split('/').slice(1).join('/'))
			.filter(Boolean)
	);

	const excludes = serializeExcludes({ includedPaths, excludedPaths: excludedPathsWithoutWorkspaceFolder });
	await config.update('exclude', excludes, vscode.ConfigurationTarget.Workspace);
}

async function readDirectory(path: string): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return [];
	}

	if (path === '') {
		return workspaceFolders.map(workspaceFolder => workspaceFolder.name + '/');
	} else {
		const rootWorkspaceFolder = workspaceFolders.find(workspaceFolder => path.startsWith(workspaceFolder.name));
		if (!rootWorkspaceFolder) {
			return [];
		}

		path = path.slice(rootWorkspaceFolder.name.length + 1);

		const uri = vscode.Uri.joinPath(rootWorkspaceFolder.uri, path.endsWith('/') ? path.slice(0, -1) : path);
		const files = await vscode.workspace.fs.readDirectory(uri);
		return files.map(([name, type]) => `${rootWorkspaceFolder.name}/${path}${name}` + (type === vscode.FileType.Directory ? '/' : ''));
	}
}

async function setIsScoped(value: boolean) {
	await vscode.workspace.getConfiguration('streamline').update('scopeEnabled', value);
	await refreshContext();
}

function getIsScoped(): boolean {
	return vscode.workspace.getConfiguration('streamline').get('scopeEnabled', false);
}

async function refreshContext() {
	await vscode.commands.executeCommand('setContext', 'streamline.scoped', await getIsScoped());
}

export function deactivate() {}
