import { getConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'

export class HighlightedPathsConfig {
  private _patterns: string[] = []
  private _cachedCombinedPatternRegExp: RegExp | undefined

  load(): boolean {
    const config = getConfig()
    const patterns = config.get<string[]>('highlightedPaths.patterns', [])

    let hasChanged = false

    if (!areArraysShallowEqual(this._patterns, patterns)) {
      this._patterns = patterns
      this._updatePatternsCache()

      hasChanged = true
    }

    console.debug('[HighlightedPaths] Config has been loaded', { hasChanged, patterns })

    return hasChanged
  }

  _updatePatternsCache() {
    this._cachedCombinedPatternRegExp = this._patterns.length > 0
      ? new RegExp(this._patterns.join('|'))
      : undefined
  }

  getCachedCombinedPatternRegExp() {
    return this._cachedCombinedPatternRegExp
  }
}
