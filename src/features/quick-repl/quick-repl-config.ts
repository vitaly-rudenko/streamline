import z from 'zod'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { Command, commandSchema, Template, templateSchema } from './common'
import { ConfigurationTarget } from 'vscode'

const defaultQuickSavePath = '$replsPath/quick-save/$datetime_$randomAdjective_$randomNoun'

export class QuickReplConfig extends FeatureConfig {
  private _quickSavePath: string = defaultQuickSavePath
  private _replsPath: string | undefined = undefined
  private _templates: Template[] = []
  private _commands: Command[] = []

  constructor() {
    super('QuickRepl')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const quickSavePath = safeConfigGet(config, 'quickRepl.quickSavePath', defaultQuickSavePath, z.string())
    const replsPath = safeConfigGet(config, 'quickRepl.replsPath', undefined, z.string().optional())
    const templates = safeConfigGet(config, 'quickRepl.templates', [], z.array(templateSchema))
    const commands = safeConfigGet(config, 'quickRepl.commands', [], z.array(commandSchema))

    let hasChanged = false

    if (
      this._quickSavePath !== quickSavePath
      || this._replsPath !== replsPath
      || JSON.stringify(this._templates) !== JSON.stringify(templates)
      || JSON.stringify(this._commands) !== JSON.stringify(commands)
    ) {
      this._quickSavePath = quickSavePath
      this._replsPath = replsPath
      this._templates = templates
      this._commands = commands

      hasChanged = true
    }

    console.debug('[QuickRepl] Config has been loaded', {
      hasChanged,
      quickSavePath: this._quickSavePath,
      replsPath: this._replsPath,
      templates: this._templates,
      commands: this._commands,
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

  getShortQuickSavePath() {
    return this._quickSavePath
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
}