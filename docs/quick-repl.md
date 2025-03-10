# Quick Repl

Quick Repl allows you to quickly create and run scripts & projects.  
You can create templates, prepare commands and view all of your scripts in a separate view.

## Setup

To setup Quick Repl, run `Quick Repl: Start Setup Wizard` command.  
It will walk you through the initial configuration and prepare some default templates for you.

## Templates

With templates, you can quickly create:
- Snippets, a.k.a Untitled files
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
```jsonc
{
  "name": "JavaScript Script",
  "description": "Opens an Untitled JavaScript file with predefined script template",
  "type": "snippet",
  "languageId": "javascript",
  "template": {
    "content": [
      "console.log('Hello, World!');"
    ]
    // ^ optionally add code to the newly created script
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
  // ^ set default path and default name for the created file
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
  // ^ specify which folder to use as a template and (optionally) which file to open after creation
}
```

## Commands

Create commands to quickly run specific actions against your Quick Repls.  
Commands can be ran on selections, files (saved and Untitled) and folders.

When multiple commands match for current context (e.g. file), you will be prompted to select which command to use.  
If you want to avoid this, set `default: true` for the preferred command.

```ts
type Command = {
  name: string
  description?: string
  default?: boolean
  cwd: string
  command: string | string[]
  when?: When
}
```

> Run `Streamline: Open Help for 'when' Syntax` command to show all possible conditions and examples for `"when"` field.

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
  "when": [{ "selection": true, "languageId": ["typescript", "javascript"] }],
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
  "when": [{ "untitled": true, "languageId": ["typescript", "javascript"] }],
}
```

Run a JavaScript file:
```json
{
  "name": "Run File (JavaScript)",
  "description": "Runs the JavaScript file with Node.js",
  "cwd": "$contextDirname",
  "command": "node $contextBasename",
  "when": [
    { "untitled": false, "languageId": "javascript" },
    { "basename": "\\.(c|m)?js$" },
  ],
}
```

Run a JavaScript project:
```json
{
  "name": "Run Project (JavaScript)",
  "description": "Runs 'npm start' in a selected directory",
  "cwd": "$contextPath",
  "command": "npm start",
  "when": [{ "fileType": "directory" }]
}
```

## Substitution variables

> Implementation: [src/features/quick-repl/toolkit/substitute.ts](../src/features/quick-repl/toolkit/substitute.ts)

Always available:
- `$homedir` - `/Users/user`
- `$replsPath` - `/Users/user/.streamline/quick-repl/repls`
- `$shortReplsPath` - `~/.streamline/quick-repl/repls`
- `$datetime` - `202504031234` (format: `YYYYMMDDHHMM`)
- `$randomNoun` - `candle`
- `$randomAdjective` - `delicate`

Available when there's a context (e.g. an opened file, a selected folder or a code selection):
- `$contextPath` - `/Users/user/path/to/file.mjs`
- `$shortContextPath` - `~/path/to/file.mjs`
- `$contextDirname` - `/Users/user/path/to`
- `$shortContextDirname` - `~/path/to`
- `$contextBasename` - `file.mjs`
- `$contextRelativePath` - if file is inside `replsPath`: `playground/my_file.mjs`, if not: `/Users/user/path/to/file.mjs`
- `$shortContextRelativePath` - if file is inside `replsPath`: `playground/my_file.mjs`, if not: `~/path/to/file.mjs`

Available when the context is a file:
- `$contextContent` - `const name = "John Doe";\nconsole.log("Hello,", name)`

Available when the context is a file with a non-empty selection:
- `$contextSelection` - `// My\n// Selection`

These variables can be used in:
- `streamline.quickRepl.commands[].command.cwd`
- `streamline.quickRepl.commands[].command.command`
- `streamline.quickRepl.templates[].template.defaultPath`
- `streamline.quickRepl.templates[].template.template.path`
