import * as vscode from 'vscode'
import { z, ZodSchema } from 'zod'

/** Get current extension configuration */
export function getConfig() {
  return vscode.workspace.getConfiguration('streamline')
}

/** Get real configuration target of the config section – a.k.a. where it's currently set */
function getEffectiveTarget(config: vscode.WorkspaceConfiguration, section: string): vscode.ConfigurationTarget | undefined {
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

/** Update config section in the place where it's currently set, otherwise use default target */
export async function updateEffectiveConfig<T>(config: vscode.WorkspaceConfiguration, defaultTarget: vscode.ConfigurationTarget, section: string, generateValue: (existsInNonDefaultTarget: boolean) => T | undefined) {
  const effectiveTarget = getEffectiveTarget(config, section)
  const target = effectiveTarget ?? defaultTarget
  const existsInNonDefaultTarget = effectiveTarget !== undefined && effectiveTarget !== defaultTarget

  await config.update(section, generateValue(existsInNonDefaultTarget), target)
}

/** Configuration loaded during extension startup (may be outdated) */
export const initialConfig = getConfig()

// If configuration section is invalid, the extension will store a backup of the invalid configuration section with the error
let invalidConfigurationBackups = initialConfig.get<unknown[]>('invalidConfigurationBackups', [])
function handleConfigError(section: string, value: unknown, error: any, target?: vscode.ConfigurationTarget) {
  console.warn('Failed to parse configuration section', section, 'due to', error)

  invalidConfigurationBackups = [
    ...invalidConfigurationBackups,
    { timestamp: new Date().toISOString(), [section]: value, error }
  ].slice(0, 25)

  getConfig().update('invalidConfigurationBackups', invalidConfigurationBackups, target)
    .then(() => {}, (err) => console.error('Could not save a backup of invalid configuration section', section, err))

  vscode.window.showWarningMessage(`Failed to parse configuration section "${section}"`).then(() => {}, () => {})
}

/** Get configuration section value and validate it against the schema */
export function safeConfigGet<T>(
  config: vscode.WorkspaceConfiguration,
  section: string,
  defaultValue: T,
  schema: ZodSchema<T>
) {
  const value = config.get(section, defaultValue)

  try {
    return schema.parse(value)
  } catch (error: any) {
    handleConfigError(section, value, error, getEffectiveTarget(config, section))
    return defaultValue
  }
}

/** Inspect configuration section value and validate it against the schema */
export function safeConfigInspect<T>(
  config: vscode.WorkspaceConfiguration,
  section: string,
  schema: ZodSchema<T>
) {
  const value = config.inspect(section)
  if (!value) return undefined

  const { globalValue, workspaceValue, workspaceFolderValue } = value

  const parsedGlobalValue = schema.optional().safeParse(globalValue)
  if (!parsedGlobalValue.success) {
    handleConfigError(section, value, parsedGlobalValue.error, vscode.ConfigurationTarget.Global)
  }

  const parsedWorkspaceValue = schema.optional().safeParse(workspaceValue)
  if (!parsedWorkspaceValue.success) {
    handleConfigError(section, value, parsedWorkspaceValue.error, vscode.ConfigurationTarget.Workspace)
  }

  const parsedWorkspaceFolderValue = schema.optional().safeParse(workspaceFolderValue)
  if (!parsedWorkspaceFolderValue.success) {
    handleConfigError(section, value, parsedWorkspaceFolderValue.error, vscode.ConfigurationTarget.WorkspaceFolder)
  }

  return {
    globalValue: parsedGlobalValue.success ? parsedGlobalValue.data : undefined,
    workspaceValue: parsedWorkspaceValue.success ? parsedWorkspaceValue.data : undefined,
    workspaceFolderValue: parsedWorkspaceFolderValue.success ? parsedWorkspaceFolderValue.data : undefined,
  }
}
