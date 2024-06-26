# Streamline

Productivity-oriented VS Code extension packed with features for working on large projects.

## Scoped Paths

Add files and folders into 'scopes' and easily toggle between them to only see what's important.  
Useful in large projects and monorepos to focus on modules that you're currently working on.

> This feature is achieved by analyzing your project files and modifying `files.exclude` accordingly.  
> Due to VS Code limitations in multi-folder workspaces, not all files are guaranteed to be hidden.

![Demo](docs/scoped_paths.gif)

## Bookmarks

Bookmark folders, files and text  selections – and organize them into lists.  
You can also add notes to your bookmarks and archive lists.

![Demo](docs/bookmarks.gif)

## Related Files

Quickly discover potentially related files, such as tests, fixtures and components.  
Available as an Explorer view and as a command in the Command Palette (`Quick Open Related Files`).

> The extension searches for files whose filenames include the current file's basename.  
> Priority is given to files within the same parent folder name.  
> You can also enable global search across all workspace folders, customize path rendering, and enable stricter search query in the settings.

![Demo](docs/related_files.gif)

## Tab History

Go through your tab history to quickly find a recently opened file.  
Tabs can be pinned for easier access.

> For tab history to be persisted between sessions, you can opt-in to saving it into your workspace file by using "Enable Backup" button.

![Demo](docs/tab_history.gif)

## Highlighted Paths

Highlight files and folder using regular expressions by adding them into `streamline.highlightedPaths.patterns` in the workspace configuration.  
Useful for highlighting tests or build files.

> Files are highlighted in all Explorer views, including Related Files, Bookmarks and Tab History.
