import { Command, Template } from './common'
import { isCommandValid, isTemplateValid } from './toolkit/validation'

export const setupReplsPath = '~/.streamline/quick-repl/repls'

export const setupTemplates: Template[] = [
  {
    name: 'JavaScript File',
    description: 'Creates an empty JavaScript file',
    type: 'file',
    defaultPath: '$replsPath/playground/$datetime_$randomAdjective_$randomNoun.mjs',
  },
  {
    name: 'JavaScript Script',
    description: 'Opens an Untitled JavaScript file with predefined script template',
    type: 'snippet',
    languageId: 'javascript',
    template: {
      content: ['console.log(\'Hello, World!\');']
    }
  },
  {
    name: 'JavaScript Project',
    description: 'Creates a JavaScript project from a template directory, and then opens src/app.js file',
    type: 'directory',
    defaultPath: '$replsPath/projects/$datetime_$randomAdjective_$randomNoun',
    template: {
      path: '$replsPath/templates/javascript-project',
      fileToOpen: 'src/app.js',
    },
  },
]

export const setupCommands: Command[] = [
  {
    name: 'Run Selection (Node.js)',
    description: 'Runs the selected JavaScript code with Node.js',
    cwd: '$replsPath',
    command: [
      'node << \'QUICKREPL\'',
      '$contextSelection',
      'QUICKREPL'
    ],
    when: [
      { selection: true, languageId: 'typescript' },
      { selection: true, languageId: 'javascript' }
    ],
  },
  {
    name: 'Run Script (Node.js)',
    description: 'Runs the Untitled JavaScript file with Node.js',
    cwd: '$replsPath',
    command: [
      'node << \'QUICKREPL\'',
      '$contextContent',
      'QUICKREPL'
    ],
    when: [
      { untitled: true, languageId: 'typescript' },
      { untitled: true, languageId: 'javascript' }
    ],
  },
  {
    name: 'Run File (Node.js)',
    description: 'Runs the JavaScript file with Node.js',
    cwd: '$contextDirname',
    command: 'node $contextBasename',
    when: [
      { untitled: false, languageId: 'javascript' },
      { basename: '\\.(c|m)?js$' },
    ],
  },
  {
    name: 'Run Project (Node.js)',
    description: 'Runs "npm start" in a selected directory',
    cwd: '$contextPath',
    command: 'npm start',
    when: [{ fileType: 'directory' }]
  },
  {
    name: 'Install Dependencies (Node.js)',
    description: 'Runs "npm install" when package.json is selected',
    cwd: '$contextDirname',
    command: 'npm install',
    when: [{ basename: 'package\.json$' }]
  },
]

// Sanity checks
for (const template of setupTemplates) {
  if (!isTemplateValid(template)) {
    throw new Error(`Invalid setup template: ${template.name}`)
  }
}
for (const command of setupCommands) {
  if (!isCommandValid(command)) {
    throw new Error(`Invalid setup command: ${command.name}`)
  }
}
