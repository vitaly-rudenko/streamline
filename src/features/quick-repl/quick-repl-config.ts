import z from 'zod'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { Command, commandSchema, Template, templateSchema } from './common'
import { ConfigurationTarget, Uri } from 'vscode'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'

const defaultTerminalName = 'Quick Repl: $contextShortPath'

export class QuickReplConfig extends FeatureConfig {
  private _replsPath: string | undefined = undefined
  private _additionalReplsPaths: string[] = []
  private _templates: Template[] = []
  private _commands: Command[] = []
  private _terminalName: string = defaultTerminalName

  constructor() {
    super('QuickRepl')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const replsPath = safeConfigGet(config, 'quickRepl.replsPath', undefined, z.string().optional())
    const additionalReplsPaths = safeConfigGet(config, 'quickRepl.additionalReplsPaths', [], z.array(z.string()))
    const templates = safeConfigGet(config, 'quickRepl.templates', [], z.array(templateSchema))
    const commands = safeConfigGet(config, 'quickRepl.commands', [], z.array(commandSchema))
    const terminalName = safeConfigGet(config, 'quickRepl.terminalName', defaultTerminalName, z.string())

    let hasChanged = false

    if (
      this._replsPath !== replsPath
      || this._terminalName !== terminalName
      || !areArraysShallowEqual(this._additionalReplsPaths, additionalReplsPaths)
      || JSON.stringify(this._templates) !== JSON.stringify(templates)
      || JSON.stringify(this._commands) !== JSON.stringify(commands)
    ) {
      this._replsPath = replsPath
      this._additionalReplsPaths = additionalReplsPaths
      this._templates = templates
      this._commands = commands
      this._terminalName = terminalName

      hasChanged = true
    }

    console.debug('[QuickRepl] Config has been loaded', {
      hasChanged,
      replsPath: this._replsPath,
      additionalReplsPaths: this._additionalReplsPaths,
      templates: this._templates,
      commands: this._commands,
      terminalName: this._terminalName,
    })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'quickRepl.replsPath',
      exists => (exists || this._replsPath !== undefined) ? this._replsPath : undefined
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'quickRepl.templates',
      exists => (exists || this._templates.length > 0) ? this._templates : undefined
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'quickRepl.commands',
      exists => (exists || this._commands.length > 0) ? this._commands : undefined
    )
  }

  getAdditionalShortReplsPaths() {
    return this._additionalReplsPaths
  }

  getShortReplsPath() {
    return this._replsPath
  }

  setShortReplsPath(value: string) {
    this._replsPath = value
  }

  getTemplates() {
    return this._templates
  }

  setTemplates(value: Template[]) {
    this._templates = value
  }

  getCommands() {
    return this._commands
  }

  setCommands(value: Command[]) {
    this._commands = value
  }

  getTerminalName() {
    return this._terminalName
  }
}