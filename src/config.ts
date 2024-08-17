import * as vscode from 'vscode'

export function getConfig() {
  return vscode.workspace.getConfiguration('streamline')
}

/**
 * Get real configuration target of the config section – a.k.a. where it's currently set.
 */
export function getEffectiveTarget(config: vscode.WorkspaceConfiguration, section: string): vscode.ConfigurationTarget | undefined {
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
 * Update config section in the place where it's currently set,
 * otherwise use default target.
 */
export async function updateEffectiveConfig<T>(config: vscode.WorkspaceConfiguration, defaultTarget: vscode.ConfigurationTarget, section: string, generateValue: (existsInNonDefaultTarget: boolean) => T | undefined) {
  const effectiveTarget = getEffectiveTarget(config, section)
  const target = effectiveTarget ?? defaultTarget
  const existsInNonDefaultTarget = effectiveTarget !== undefined && effectiveTarget !== defaultTarget

  await config.update(section, generateValue(existsInNonDefaultTarget), target)
}

export const initialConfig = getConfig()

