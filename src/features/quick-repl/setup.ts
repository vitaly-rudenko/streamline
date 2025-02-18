import { Command, Template } from './common'


export const setupReplsPath = '~/.streamline/quick-repl/repls'

export const setupTemplates: Template[] = [
  {
    name: 'JavaScript Script',
    description: 'Opens an Untitled JavaScript file with predefined script template',
    type: 'snippet',
    languageId: 'javascript',
    template: {
      content: [
        'console.log(\'Hello, World!\');'
      ]
    }
  },
  {
    name: 'JavaScript File',
    description: 'Creates an empty JavaScript file',
    type: 'file',
    defaultPath: '$replsPath/playground/$datetime_$randomNoun.mjs',
  },
  {
    name: 'JavaScript Project',
    description: 'Creates a JavaScript project from a template directory, and then opens src/app.js file',
    type: 'directory',
    defaultPath: '$replsPath/projects/$datetime_$randomNoun',
    template: {
      path: '$replsPath/templates/javascript-project',
      fileToOpen: 'src/app.js',
    },
  },
]

export const setupCommands: Command[] = [
  {
    name: 'Run Selection (JavaScript)',
    description: 'Runs the selected JavaScript code with Node.js',
    cwd: '$replsPath',
    command: [
      'node << \'QUICKREPL\'',
      '$contextSelection',
      'QUICKREPL'
    ],
    when: [
      [{ selection: true }, { languageId: 'typescript' }],
      [{ selection: true }, { languageId: 'javascript' }]
    ],
  },
  {
    name: 'Run Script (JavaScript)',
    description: 'Runs the Untitled JavaScript file with Node.js',
    cwd: '$replsPath',
    command: [
      'node << \'QUICKREPL\'',
      '$contextContent',
      'QUICKREPL'
    ],
    when: [
      [{ untitled: true }, { languageId: 'typescript' }],
      [{ untitled: true }, { languageId: 'javascript' }]
    ],
  },
  {
    name: 'Run File (JavaScript)',
    description: 'Runs the JavaScript file with Node.js',
    cwd: '$contextDirname',
    command: 'node $contextBasename',
    when: [
      [{ untitled: false }, { languageId: 'javascript' }],
      [{ basename: '\\.(c|m)?js$' }],
    ],
  },
  {
    name: 'Run Project (JavaScript)',
    description: 'Runs "npm start" when package.json or a directory is selected',
    cwd: '$contextPath',
    command: 'npm start',
    when: [
      { basename: '^package\\.json$' },
      { fileType: 'directory' }
    ]
  },
]
