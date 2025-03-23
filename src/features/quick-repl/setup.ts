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
    when: [{ languageId: ['typescript', 'javascript'], selection: true }],
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
    when: [{ languageId: ['typescript', 'javascript'], untitled: true }],
  },
  {
    name: 'Run File (Node.js)',
    description: 'Runs the JavaScript file with Node.js',
    cwd: '$contextDirname',
    command: 'node $contextBasename',
    when: [
      { languageId: ['javascript', 'javascript'], untitled: false },
      { basename: ['\\.(c|m)?ts$', '\\.(c|m)?js$'] },
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
    confirm: true,
    when: [{ basename: 'package\.json$' }]
  },
  {
    name: 'Open in Browser',
    description: 'Opens the selected HTML file in a browser',
    command: 'open $contextPath',
    cwd: '$contextDirname',
    when: [{ basename: '\\.html?$' }]
  }
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
