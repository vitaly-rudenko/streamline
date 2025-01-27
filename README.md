# Streamline

Productivity-oriented VS Code extension packed with features for working on large projects.

## Scoped Paths

Add files and folders into 'scopes' and easily toggle between them to only see what's important.
Useful in large projects and monorepos to focus on modules that you're currently working on.

> This feature is achieved by analyzing your project files and modifying `files.exclude` accordingly.
> Due to VS Code limitations in multi-folder workspaces, not all files are guaranteed to be hidden.

![Demo](docs/scoped_paths.gif)

Configuration example:
```json
"streamline.scopedPaths.scopes": {
    "Bookmarks": [
        "streamline/src/features/bookmarks",
        "streamline/test/features/bookmarks"
    ]
}
```

## Bookmarks

Bookmark folders, files and text  selections – and organize them into lists.
You can also add notes to your bookmarks and archive lists.

![Demo](docs/bookmarks.gif)

## Related Files

Quickly discover potentially related files, such as tests, fixtures and components.
Available as an Explorer view and as a command in the Command Palette (`Quick Open Related File...`).

> The extension searches for files whose basename include the current file's basename.
> Priority is given to files within the same parent folder name.
> You can also enable global search across all workspace folders and enable stricter search query in the settings.

![Demo](docs/related_files.gif)

## Smart Config

Automatically apply configuration presets when certain conditions are met (such as current path, language or color theme).
For example, it can be used to only enable Github Copilot in test files or when toggled in the status bar.

![Demo](docs/smart_config.gif)

Configuration example:
```json
"streamline.smartConfig.defaults": {
    "workbench.iconTheme": "catppuccin-latte",
    "github.copilot.editor.enableAutoCompletions": false
},
"streamline.smartConfig.configs": {
    "Copilot": { "github.copilot.editor.enableAutoCompletions": true },
    "Dark theme": { "workbench.iconTheme": "catppuccin-macchiato" }
},
"streamline.smartConfig.toggles": ["Copilot"],
"streamline.smartConfig.rules": [
    {
        "apply": ["Copilot"],
        "when": [
            { "basename": "\\.(test|spec|e2e-spec)\\.(c?m?jsx?|c?m?tsx?)$" },
            { "basename": "\\.(model|controller)\\.(c?m?jsx?|c?m?tsx?)$" },
            { "path": "\\/__(tests|mocks|snapshots)__\\/" },
            { "toggle": "Copilot" }
        ]
    },
    {
        "apply": ["Dark theme"],
        "when": [{ "colorThemeKind": "dark" }]
    }
]
```

## Highlighted Paths

Highlight files and folder using regular expressions by adding them into `streamline.highlightedPaths.patterns` in the workspace configuration.
Useful for highlighting tests or build files.

> Files are highlighted in all Explorer views, including Related Files and Bookmarks.

Configuration example:
```json
"streamline.highlightedPaths.patterns": [
    "\\.(test|spec|snap|mock|e2e-spec)",
    "__(tests|mocks|snapshots)__",
    "_spec\\."
]
```

## Current Path

Show currently opened file path in the status bar, as well as detailed information about current selection.

> Click to quickly copy current path.
