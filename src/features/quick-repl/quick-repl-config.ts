import z from 'zod'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { Command, commandSchema, Template, templateSchema } from './common'
import { Uri } from 'vscode'
import { replaceShorthandWithHomedir } from './quick-repl-feature'

const defaultReplsPath = '~/.streamline/quick-repl/repls'
const defaultTemplates: Template[] = [
  {
    name: 'JavaScript File',
    type: 'file',
    defaultPath: '$replsPath/playground',
    defaultName: '$datetime_$randomNoun.mjs',
  },
  {
    name: 'JavaScript Project',
    type: 'directory',
    defaultPath: '$replsPath/projects',
    defaultName: '$datetime_$randomNoun',
    template: {
      path: '$replsPath/templates/javascript-project',
      mainFilePath: 'app.js',
    },
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
    when: [
      [{ untitled: true }, { languageId: 'typescript' }],
      [{ untitled: true }, { languageId: 'javascript' }]
    ],
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

    console.log({ replsPath, templates, defaultTemplates, commands })

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

  async save() {}

  getReplsPath() {
    return this._replsPath
  }

  getReplsUri() {
    return Uri.file(replaceShorthandWithHomedir(this._replsPath))
  }

  getTemplates() {
    return this._templates
  }

  getCommands() {
    return this._commands
  }
}