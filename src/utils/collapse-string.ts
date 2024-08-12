export function collapseString(input: string, stringToCollapse: string, maxWidth: number, collapsedIndicator: string) {
    if (input.length <= maxWidth) return input

    const collapsedLength = input.length - stringToCollapse.length + 1

    const charactersLeft = Math.max(0, maxWidth - collapsedLength)
    const sliceLength = Math.floor(charactersLeft / 2)

    return input.replace(stringToCollapse, sliceLength > 0 ? stringToCollapse.slice(0, sliceLength) + collapsedIndicator + stringToCollapse.slice(-sliceLength) : collapsedIndicator)
}
