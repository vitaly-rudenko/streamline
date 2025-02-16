import { Command, Template } from "./common"


const setupReplsPath = '~/.streamline/quick-repl/repls'

type SetupTemplate = {
  description: string
  template: Template
}

const setupTemplates: SetupTemplate[] = [
  {
    description: 'Opens an Untitled JavaScript file with predefined script template',
    template: {
      name: 'JavaScript Script',
      type: 'snippet',
      languageId: 'javascript',
      template: {
        content: [
          'import * as fs from "fs"',
          'import * as path from "path"',
          '',
          ''
        ]
      }
    }
  },
  {
    description: 'Creates an empty JavaScript file',
    template: {
      name: 'JavaScript File',
      type: 'file',
      defaultPath: '$replsPath/playground/$datetime_$randomNoun.mjs',
    }
  },
  {
    description: 'Creates a JavaScript project from a template directory, and then opens src/app.js file',
    template: {
      name: 'JavaScript Project',
      type: 'directory',
      defaultPath: '$replsPath/projects/$datetime_$randomNoun',
      template: {
        path: '$replsPath/templates/javascript-project',
        fileToOpen: 'src/app.js',
      },
    }
  },
]

type SetupCommand = {
  description: string
  command: Command
}

const setupCommands: SetupCommand[] = [
  {
    description: 'Runs the selected JavaScript code with Node.js',
    command: {
      name: 'Run Selection (JavaScript)',
      cwd: '$replsPath',
      command: [
        'node << \'QUICKREPL\'',
        '$fileSelection',
        'QUICKREPL'
      ],
      when: [
        [{ selection: true }, { languageId: 'typescript' }],
        [{ selection: true }, { languageId: 'javascript' }]
      ],
    }
  },
  {
    description: 'Runs the Untitled JavaScript file with Node.js',
    command: {
      name: 'Run Script (JavaScript)',
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
    }
  },
  {
    description: 'Runs the JavaScript file with Node.js',
    command: {
      name: 'Run File (JavaScript)',
      cwd: '$fileDirectory',
      command: 'node $fileBasename',
      when: [
        [{ untitled: false }, { languageId: 'javascript' }],
        [{ basename: '\\.(c|m)?js$' }],
      ],
    }
  },
  {
    description: 'Runs "npm start" when package.json or a directory is selected',
    command: {
      name: 'Run Project (JavaScript)',
      cwd: '$fileDirectory',
      command: 'npm start',
      when: [
        { basename: '^package\\.json$' },
        { fileType: 'directory' }
      ]
    }
  },
]
