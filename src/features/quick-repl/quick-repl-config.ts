import z, { defaultErrorMap } from 'zod';
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config';
import { FeatureConfig } from '../feature-config';
import { Command, commandSchema, Template, templateSchema } from './common';
import { ConfigurationTarget } from 'vscode';

const defaultReplsPath = '~/.streamline/repls'
const defaultTemplates: Template[] = [
  {
    name: 'JavaScript File',
    type: 'file',
    path: '$replsPath/$datetime_$randomNoun.mjs',
  },
  {
    name: 'JavaScript Project',
    type: 'directory',
    path: '$replsPath/$datetime_$randomNoun',
    template: { path: '$replsPath/templates/javascript-project' },
  },
]
const defaultCommands: Command[] = [
  {
    name: 'Run JavaScript script',
    cwd: '$replsPath',
    command: [
      'node << \'QUICKREPL\'',
      '$fileContent',
      'QUICKREPL'
    ],
    when: [[{ untitled: true }, { languageId: 'javascript' }]],
  },
  {
    name: 'Run JavaScript file',
    cwd: '$fileDirectory',
    command: 'node $fileBasename',
    when: [
      [{ untitled: false }, { languageId: 'javascript' }],
      [{ basename: '\\.(c|m)?js$' }],
    ],
  },
  {
    name: 'Run JavaScript project',
    cwd: '$fileDirectory',
    command: 'npm start',
    when: [{ basename: '^package\\.json$' }]
  },
]

export class QuickReplConfig extends FeatureConfig {
  private _replsPath: string = defaultReplsPath
  private _templates: Template[] = defaultTemplates
  private _commands: Command[] = defaultCommands

  constructor() {
    super('QuickRepl')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const replsPath = safeConfigGet(config, 'quickRepl.replsPath', defaultReplsPath, z.string())
    const templates = safeConfigGet(config, 'quickRepl.templates', defaultTemplates, z.array(templateSchema))
    const commands = safeConfigGet(config, 'quickRepl.commands', defaultCommands, z.array(commandSchema))

    let hasChanged = false

    if (
      this._replsPath !== replsPath
      || JSON.stringify(this._templates) !== JSON.stringify(templates)
      || JSON.stringify(this._commands) !== JSON.stringify(commands)
    ) {
      this._replsPath = replsPath
      this._templates = templates
      this._commands = commands

      hasChanged = true
    }

    console.debug('[QuickRepl] Config has been loaded', {
      hasChanged,
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
      exists => (exists || this._replsPath !== defaultReplsPath) ? this._replsPath : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'quickRepl.templates',
      exists => (exists || JSON.stringify(this._templates) !== JSON.stringify(defaultTemplates)) ? this._templates : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'quickRepl.commands',
      exists => (exists || JSON.stringify(this._commands) !== JSON.stringify(defaultCommands)) ? this._commands : undefined,
    )

    console.debug('[QuickRepl] Config has been saved')
  }

  getReplsPath() {
    return this._replsPath
  }

  getTemplates() {
    return this._templates
  }

  getCommands() {
    return this._commands
  }
}