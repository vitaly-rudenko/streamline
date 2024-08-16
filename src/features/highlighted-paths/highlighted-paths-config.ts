import { getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { FeatureConfig } from '../feature-config'

export class HighlightedPathsConfig extends FeatureConfig {
  private _patterns: string[] = []
  private _cachedCombinedPatternRegExp: RegExp | undefined

  constructor() {
    super('HighlightedPaths')
    this.load(initialConfig)
    this._updatePatternsCache()
  }

  load(config = getConfig()) {
    const patterns = config.get<string[]>('highlightedPaths.patterns', [])

    let hasChanged = false

    if (!areArraysShallowEqual(this._patterns, patterns)) {
      this._patterns = patterns

      hasChanged = true
    }

    if (hasChanged) {
      this._updatePatternsCache()
    }

    console.debug('[HighlightedPaths] Config has been loaded', { hasChanged, patterns })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      'highlightedPaths.patterns',
      this._patterns.length > 0 ? this._patterns : undefined
    )

    console.debug('[HighlightedPaths] Config has been saved')
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
