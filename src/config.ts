import * as vscode from 'vscode'

export function getConfig() {
  return vscode.workspace.getConfiguration('streamline')
}

// Get the ConfigurationTarget (read: scope) of where the *effective* setting value comes from
export function getEffectiveConfigurationTarget(config: vscode.WorkspaceConfiguration, section: string): vscode.ConfigurationTarget | undefined {
  const detail = config.inspect(section)
  if (detail === undefined) {
    return undefined
  } else if (typeof detail.workspaceFolderValue !== 'undefined') {
    return vscode.ConfigurationTarget.WorkspaceFolder
  } else if (typeof detail.workspaceValue !== 'undefined') {
    return vscode.ConfigurationTarget.Workspace
  } else if (typeof detail.globalValue !== 'undefined') {
    return vscode.ConfigurationTarget.Global
  }

  return undefined
}

export async function updateEffectiveConfig(
  config: vscode.WorkspaceConfiguration,
  section: string,
  value: any,
  defaultTarget: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
) {
  const target = getEffectiveConfigurationTarget(config, section) ?? defaultTarget
  await config.update(section, value, target)
}

export const initialConfig = getConfig()

