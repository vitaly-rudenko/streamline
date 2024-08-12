# Change Log

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
