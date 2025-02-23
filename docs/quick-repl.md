# Quick Repl

Quick Repl allows you to quickly create and run scripts & projects.  
You can create templates, prepare commands and view all of your scripts in a separate view.

## Setup

To setup Quick Repl, run `Quick Repl: Setup` command.  
It will walk you through the initial configuration and prepare some default templates for you.

## Templates

With templates, you can quickly create:
- Scripts, a.k.a Untitled files
- Files, either empty or with predefined contents
- Projects – for example, a prepared setup for a HTML & CSS & JS app

Create as many templates as you need, because you can choose which one to use whenever you create a new Quick Repl.

```ts
type Template = SnippetTemplate | FileTemplate | ProjectTemplate

type SnippetTemplate = {
  name: string
  description?: string
  type: 'snippet'
  /** https://code.visualstudio.com/docs/languages/identifiers */
  languageId: string
  template?: { content: string[] } | { path: string }
}

type FileTemplate = {
  name: string
  description?: string
  type: 'file'
  defaultPath?: string
  template?: { content: string[] } | { path: string }
}

type ProjectTemplate = {
  name: string
  description?: string
  type: 'directory'
  defaultPath: string
  template: {
    path: string
    fileToOpen?: string
  }
}
```

### Snippets

Example of a snippet template:
```json
{
  "name": "JavaScript Script",
  "description": "Opens an Untitled JavaScript file with predefined script template",
  "type": "snippet",
  "languageId": "javascript",
  "template": {
    "content": [
      "console.log('Hello, World!');"
    ]
  }
}
```

### Files

Example of a file template:
```json
{
  "name": "JavaScript File",
  "description": "Creates an empty JavaScript file",
  "type": "file",
  "defaultPath": "$replsPath/playground/$datetime_$randomNoun.mjs"
}
```

### Projects

Example of a project template:
```json
{
  "name": "JavaScript Project",
  "description": "Creates a JavaScript project from a template directory, and then opens src/app.js file",
  "type": "directory",
  "defaultPath": "$replsPath/projects/$datetime_$randomNoun",
  "template": {
    "path": "$replsPath/templates/javascript-project",
    "fileToOpen": "src/app.js"
  }
}
```

## Commands

Create commands to quickly run specific actions against your Quick Repls.  
Commands can be ran on selections, files (saved and Untitled) and folder.

When multiple commands match for current context (e.g. file), you will be prompted to select which command to use.  
If you want to avoid this, set `default: true` for the preferred command.

```ts
type Command = {
  name: string
  description?: string
  default?: boolean
  cwd: string
  command: string | string[]
  // see docs/when.md for 'When' syntax documentation
  when?: When
}
```

### Examples

Run selected JavaScript snippet:
```json
{
  "name": "Run Selection (JavaScript)",
  "description": "Runs the selected JavaScript code with Node.js",
  "cwd": "$replsPath",
  "command": [
    "node << 'QUICKREPL'",
    "$contextSelection",
    "QUICKREPL"
  ],
  "when": [
    [{ "selection": true }, { "languageId": "typescript" }],
    [{ "selection": true }, { "languageId": "javascript" }]
  ],
}
```

Run a JavaScript file (Untitled):
```json
{
  "name": "Run Script (JavaScript)",
  "description": "Runs the Untitled JavaScript file with Node.js",
  "cwd": "$replsPath",
  "command": [
    "node << 'QUICKREPL'",
    "$contextContent",
    "QUICKREPL"
  ],
  "when": [
    [{ "untitled": true }, { "languageId": "typescript" }],
    [{ "untitled": true }, { "languageId": "javascript" }]
  ],
}
```

Run a JavaScript file (saved):
```json
{
  "name": "Run File (JavaScript)",
  "description": "Runs the JavaScript file with Node.js",
  "cwd": "$contextDirname",
  "command": "node $contextBasename",
  "when": [
    [{ "untitled": false }, { "languageId": "javascript" }],
    [{ "basename": "\\.(c|m)?js$" }],
  ],
}
```

Run a JavaScript project:
```json
{
  "name": "Run Project (JavaScript)",
  "description": "Runs "npm start" when package.json or a directory is selected",
  "cwd": "$contextPath",
  "command": "npm start",
  "when": [
    { "basename": "^package\\.json$" },
    { "fileType": "directory" }
  ]
}
```

## Variables

All variables in paths and terminal names:
- `$replsPath` (example: `~/.streamline/quick-repl/repls`)
- `$contextPath` (example: `~/.streamline/quick-repl/repls/file.mjs`)
- `$contextBasename` (example: `file.mjs`)
- `$contextDirname` (example: `~/.streamline/quick-repl/repls`)
- `$contextContent` - full contents of file (if available)
- `$contextSelection` - current selection (if available and not empty)
- `$shortContextPath` (only available in terminal names)
- `$datetime` - timestamp in `YYYYMMDDHHMM` format
- `$randomNoun` (example: `squirrel`)

These variables can be used in `template.defaultPath`, `template.template.path`, `command.cwd`, `command.command` and `terminalName` fields.
