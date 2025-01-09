/** Returns a list of the targeted items for a VS Code command context */
export function getTargetItemsForCommand<T>(item: T | undefined, selectedItems: T[] | undefined): T[] {
  if (selectedItems && selectedItems.length > 0) {
    return selectedItems
  } else if (item) {
    return [item]
  } else {
    return []
  }
}
