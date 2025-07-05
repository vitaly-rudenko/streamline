# Change Log

## 0.53

### Scoped Paths

- Added "Scoped Paths: Quick Unscope" feature that temporarily disables the Current Scope until one of these conditions is met:
  - A new unscoped file has been opened opened
  - A new path was added to the Current Scope
  - Current Scope has been re-enabled manually
- Dynamic Scopes (such as Quick Scopes and Bookmarks Scope) can now be modified, which creates an editable copy
- Added "Duplicate..." button in "Scoped Paths: Change Current Scope..." menu

> Quick Unscope resets automatically when Current Scope changes, or when Quick Scope is used, or when "Streamline: Disable Current Scope" command is executed.

### Bookmarks

- Added "Bookmarks: Open All Files from List" command
- Added "Bookmarks: Add Files from List to Copilot" command

## 0.52

### General

- Added `hasBreakpoints` and `hasVisibleFoldedRegions` conditions in `when` syntax

### Quick Repl

- Added "Quick Repl: Quick Save..." command (experimental)
- Quick save path can be modified by changing `streamline.quickRepl.quickSavePath` config section

### Scoped Paths

- Added a small workaround to fix current scope status rendering in Explorer view

### Bookmarks

- Added "Bookmarks: Clear Current List" command
- Added "Clear List" context menu command in Bookmarks List

## 0.51

### Bookmarks

- Added bookmark count to each list in Bookmarks View

### Current Path

- Added "Total Characters" and "Selections" stats
- Improved documentation when hovering over Current Selection status bar icon

### Scoped Paths

- Improved Scope stats in "Change Current Scope" command

## 0.50

### General

- Added command to view documentation for 'when' syntax: `Streamline: Syntax for 'when' (Help)`
- Refactored 'when' syntax and added new conditions, such as `selection`, `fileType` and `untitled`

### New feature: Quick Repl

Easily create scripts and projects, and run them.  
Supports templates, custom commands, and a separate tree view for your snippets.

- Setup with `Quick Repl: Setup` command
- Check documentation with `Streamline: Quick Repl (Help)` command

### Scoped Paths

- You can now scope into your bookmarks (from the currently selected list)

### Bookmarks

- Added "Quick Open Bookmark from Current List" command as alternative to the view
- You can now delete bookmark from a file in Explorer view
- Fixed deletion and context detection when you have multiple lists

### Related Files

- Default key bind for "Quick Open Related File..." is now "Alt+P"

### Current Path

- Now copies path without workspace folder prefix

## 0.40

### General

- All configuration sections are now validated, and if configuration section is invalid, its backup will be saved into `streamline.invalidConfigurationBackups`
  > This ensures that extension works correctly while keeping your configuration safe in case of mistakes
- Improved documentation for most configuration sections

### Bookmarks

- Bulk move and bulk deletion is now supported in the Bookmarks view
- Bookmarked files now have badges in the Explorer view

## 0.30

### Bookmarks

- Bookmarks can now be moved between lists
- Undo history now persists when VS Code is restarted
- Removed deprecated configuration & features

### Current Path

- Collapses the path if it's too long
- Clicking on the status bar item will now copy the path into the clipboard
- Added "Current Selection" status bar item, which shows more information about current selection than built-in VS Code feature

### Related Files

- Now works better for files like `my.service.test.ts` (e.g. in NestJS)
- Removed deprecated configuration & features

### Scoped Paths

- Now automatically & safely hides workspace folders when scoped in

### Smart Config

- Reworked the configuration:
  - Added "configuration presets" that can be applied in multiple rules
  - Added "rules" that can contain multiple conditions, such as: path, basename, current color theme, scope, languageId and custom toggles
- Added "custom toggles" that are shown in the status bar and can be used to quickly toggle configuration presets

### Tab History

- Removed

## 0.21

### Smart Config

- **Automatically update settings depending on the current file path pattern**
  > You can now enable or disable certain configuration settings by using `streamline.smartConfig.patterns` object.
  > Each key is a regular expression pattern and each value is an object that contains settings overrides.
  > `"default"` is a special key for settings that are always applied before applying overrides.
  > `"__unset_by_streamline__"` is a special value to remove settings, including default and overridden ones.

## 0.20

### General

- **Added ability to toggle certain features off completely**
- Configuration keys now preserve the place where they're currently set

### Scoped Paths

- **Added ability to exclude paths from scopes** to hide certain files or folders when scoping
  > Note that buttons and views are not hidden even when features are disabled
- `streamline.scopedPaths.currentScope` and `streamline.scopedPaths.enabled` configuration keys have been removed – they are now stored in `workspaceState`

### Bookmarks

- `streamline.bookmarks.currentList` configuration key have been removed – it is now stored in `workspaceState`

## 0.19

### Current Path

- **Added status bar item that shows current file path**
  > Can be temporarily hidden by clicking.

## 0.18

### Scoped Paths

- **Added "Quick Scope" functionality** to temporarily scope into a workspace folder or any other path
  > Available as a "Quick Scope into Selected" command and as dynamic scopes in "Change Current Scope..." command
- **Added configurable "Highlight status bar items when scope is enabled" setting** (enabled by default)
- Related file labels are now smartly shortened when exceeding certain length
  > Configurable with `streamline.relatedFiles.maxLabelLength` and `streamline.relatedFiles.collapsedIndicator`

### Tab History

- **Added "Quick Open from Tab History" command**

## 0.17

- Significantly optimized extension startup time and overall performance

### Related Files

- **Improved Global Search** by grouping results into workspace folders
- Workspace folders can now be hidden from Global Search results
  > Right click on a workspace folder in Related Files view to hide it.

### Scoped Paths

- Adding workspace folders to a scope now correctly hides files in other workspace folders
- Improved algorithm for better reliability
  > Due to VS Code limitations for `files.excludes` in multi-folder workspaces, some non-scoped files may be shown.
  > The priority is to always show scoped files even if it means showing some non-scoped ones.

## 0.16

### Related Files

- **Improved Tree View** – it will now match filenames that contain current file's basename at any position
- **Improved Quick Open** - hyphens and underscores are now removed so that similar files with different cases are properly matched
  > Can be disabled by setting `streamline.relatedFiles.useStricterQuickOpenQuery` to `true`.
- **Added "Use Global Search" toggle** to allow searching for related files across all workspace folders
  > Enables global search in both Related Files view and in Quick Open Related Files command.
- **Added experimental "Use Compact Paths" toggle** to make absolute paths more readable
  > When enabled, folders are completely removed from paths except for files with equal filenames.
- **Added "Open to the Side" button** to quickly open related file in split view

### Bookmarks

- **Added ability to rename bookmarks lists**
- **Added ability to edit bookmark notes**
- **Added "Restore Deleted Bookmarks" button**
  > Deletion history is only stored in current session.
- Move archived lists to the bottom of list selection popup

## 0.15

### Bookmarks

- **Added ability to archive/unarchive bookmarks lists**
- Changed view title button to "Create Bookmarks List"
- Collapse inactive lists by default, as well as non-virtual file bookmarks
- Added icons for selection bookmarks

### Tab History

- Added "Pinned" and "Recently opened" section to the view for better visibility

## 0.14

### Scoped Paths

- Fixed how files with similar paths are excluded which should improve reliability

### Bookmarks

- **Introduced "Add File to Bookmarks" command and added an icon for it to the Editor title**
- Allow bookmarking virtual files (non-bookmarked files that contain bookmarked selections)
- Add "Change Current Bookmarks List" command
- Selection bookmarks' values are now stored as is, without formatting or character limit
- Selection bookmarks' previews are generated dynamically with better readability and helpful tooltips
