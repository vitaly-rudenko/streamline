import * as vscode from 'vscode'

export function getConfig() {
  return vscode.workspace.getConfiguration('streamline')
}

/**
 * Get real configuration target of the config section – a.k.a. where it's currently set.
 */
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

/**
 * Used instead of `config.has()` because `config.has()` returns true even when value is not set,
 * most probably because of the `defaultValue`.
 *
 * Getting effective configuration target is a more reliable way to check if config section is set.
 */
export function configExists(config: vscode.WorkspaceConfiguration, section: string): boolean {
  return getEffectiveConfigurationTarget(config, section) !== undefined
}

/**
 * Update config section in the place where it's currently set,
 * otherwise use default target.
 */
export async function updateEffectiveConfig(config: vscode.WorkspaceConfiguration, section: string, value: any, defaultTarget: vscode.ConfigurationTarget) {
  const target = getEffectiveConfigurationTarget(config, section) ?? defaultTarget
  await config.update(section, value, target)
}

export const initialConfig = getConfig()

