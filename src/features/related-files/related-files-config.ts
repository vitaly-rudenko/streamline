import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'
import z from 'zod'

const defaultUseExcludes = true
const defaultUseGlobalSearch = false
const defaultMaxLabelLength = 60
const defaultCollapsedIndicator = '⸱⸱⸱'
const defaultExcludedSuffixes = ['spec', 'test', 'e2e-spec']

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useExcludes: boolean = defaultUseExcludes
  private _useGlobalSearch: boolean = defaultUseGlobalSearch
  private _hiddenWorkspaceFoldersInGlobalSearch: string[] = []
  private _maxLabelLength: number = defaultMaxLabelLength
  private _collapsedIndicator: string = defaultCollapsedIndicator
  private _excludedSuffixes: string[] = defaultExcludedSuffixes

  constructor() {
    super('RelatedFiles')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const customExcludes = safeConfigGet(config, 'relatedFiles.exclude', {}, z.record(z.unknown()))
    const useExcludes = safeConfigGet(config, 'relatedFiles.useExcludes', defaultUseExcludes, z.boolean())
    const useGlobalSearch = safeConfigGet(config, 'relatedFiles.useGlobalSearch', defaultUseGlobalSearch, z.boolean())
    const hiddenWorkspaceFoldersInGlobalSearch = safeConfigGet(config, 'relatedFiles.hiddenWorkspaceFoldersInGlobalSearch', [], z.array(z.string()))
    const maxLabelLength = safeConfigGet(config, 'relatedFiles.maxLabelLength', defaultMaxLabelLength, z.number().nonnegative())
    const collapsedIndicator = safeConfigGet(config, 'relatedFiles.collapsedIndicator', defaultCollapsedIndicator, z.string())
    const excludedSuffixes = safeConfigGet(config, 'relatedFiles.excludedSuffixes', defaultExcludedSuffixes, z.array(z.string()))

    let hasChanged = false

    if (
      this._useExcludes !== useExcludes
      || this._useGlobalSearch !== useGlobalSearch
      || this._maxLabelLength !== maxLabelLength
      || this._collapsedIndicator !== collapsedIndicator
      || !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || !areArraysShallowEqual(this._hiddenWorkspaceFoldersInGlobalSearch, hiddenWorkspaceFoldersInGlobalSearch)
      || !areArraysShallowEqual(this._excludedSuffixes, excludedSuffixes)
    ) {
      this._useExcludes = useExcludes
      this._useGlobalSearch = useGlobalSearch
      this._maxLabelLength = maxLabelLength
      this._collapsedIndicator = collapsedIndicator
      this._customExcludes = customExcludes
      this._hiddenWorkspaceFoldersInGlobalSearch = hiddenWorkspaceFoldersInGlobalSearch
      this._excludedSuffixes = excludedSuffixes

      hasChanged = true
    }

    console.debug(`[RelatedFiles] Config has been loaded (hasChanged: ${hasChanged})`, {
      useExcludes,
      useGlobalSearch,
      maxLabelLength,
      collapsedIndicator,
      customExcludes,
      hiddenWorkspaceFoldersInGlobalSearch,
      excludedSuffixes,
    })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'relatedFiles.useExcludes',
      exists => (exists || this._useExcludes !== defaultUseExcludes) ? this._useExcludes : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Global,
      'relatedFiles.useGlobalSearch',
      exists => (exists || this._useGlobalSearch !== defaultUseGlobalSearch) ? this._useGlobalSearch : undefined,
    )

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Workspace,
      'relatedFiles.hiddenWorkspaceFoldersInGlobalSearch',
      exists => (exists || this._hiddenWorkspaceFoldersInGlobalSearch.length > 0) ? this._hiddenWorkspaceFoldersInGlobalSearch : undefined,
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getExcludedSuffixes() {
    return this._excludedSuffixes
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  getMaxLabelLength() {
    return this._maxLabelLength
  }

  getCollapsedIndicator() {
    return this._collapsedIndicator
  }

  setHiddenWorkspaceFoldersInGlobalSearch(value: string[]) {
    this._hiddenWorkspaceFoldersInGlobalSearch = value
  }

  getHiddenWorkspaceFoldersInGlobalSearch() {
    return this._hiddenWorkspaceFoldersInGlobalSearch
  }

  setUseGlobalSearch(value: boolean) {
    this._useGlobalSearch = value
  }

  getUseGlobalSearch() {
    return this._useGlobalSearch
  }

  setUseExcludes(value: boolean) {
    this._useExcludes = value
  }

  getUseExcludes() {
    return this._useExcludes
  }
}
