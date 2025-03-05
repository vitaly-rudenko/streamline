import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'
import z from 'zod'

const defaultExcludedSuffixes = ['spec', 'test', 'e2e-spec']

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _excludedSuffixes: string[] = defaultExcludedSuffixes

  constructor() {
    super('RelatedFiles')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const customExcludes = safeConfigGet(config, 'relatedFiles.exclude', {}, z.record(z.unknown()))
    const excludedSuffixes = safeConfigGet(config, 'relatedFiles.excludedSuffixes', defaultExcludedSuffixes, z.array(z.string()))

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || !areArraysShallowEqual(this._excludedSuffixes, excludedSuffixes)
    ) {
      this._customExcludes = customExcludes
      this._excludedSuffixes = excludedSuffixes

      hasChanged = true
    }

    console.debug(`[RelatedFiles] Config has been loaded (hasChanged: ${hasChanged})`, {
      customExcludes,
      excludedSuffixes,
    })

    return hasChanged
  }

  async save() {}

  getExcludedSuffixes() {
    return this._excludedSuffixes
  }

  getCustomExcludes() {
    return this._customExcludes
  }
}
