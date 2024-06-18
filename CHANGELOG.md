# Change Log

## 0.16

### RelatedFiles

- **Improved Tree View** – it will now match filenames that contain current file's basename at any position
- **Improved Quick Open** - hyphens and underscores are now replaced with whitespace so that similar files with different cases are properly matched

### Bookmarks

- **Added ability to rename bookmarks lists**
- **Added ability to edit bookmark notes**
- Move archived lists to the bottom of list selection popup

## 0.15

### Bookmarks

- **Added ability to archive/unarchive bookmarks lists**
- Changed view title button to "Create Bookmarks List"
- Collapse inactive lists by default, as well as non-virtual file bookmarks
- Added icons for selection bookmarks

### TabHistory

- Added "Pinned" and "Recently opened" section to the view for better visibility

## 0.14

### ScopedPaths

- Fixed how files with similar paths are excluded which should improve reliability

### Bookmarks

- **Introduced "Add File to Bookmarks" command and added an icon for it to the Editor title**
- Allow bookmarking virtual files (non-bookmarked files that contain bookmarked selections)
- Add "Change Current Bookmarks List" command
- Selection bookmarks' values are now stored as is, without formatting or character limit
- Selection bookmarks' previews are generated dynamically with better readability and helpful tooltips
