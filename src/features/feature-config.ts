const MAX_ATTEMPTS = 10
const MIN_ATTEMPT_INTERVAL_MS = 100

export abstract class FeatureConfig {
  private _saveInBackgroundQueue = Promise.resolve()
  private _isSavingInBackground = false

  constructor(private readonly featureName: string) {}

  abstract load(): boolean
  abstract save(): Promise<void>

  async saveInBackground(attempt = 1) {
    this._saveInBackgroundQueue = this._saveInBackgroundQueue
      .then(() => {
        this._isSavingInBackground = true
        console.log(`[${this.featureName}] Saving config in background (attempt: ${attempt})`)
        return this.save()
      })
      .catch((error) => {
        console.warn(`[${this.featureName}] Could not save config in background (attempt: ${attempt})`, error)

        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => this.saveInBackground(attempt + 1), attempt * MIN_ATTEMPT_INTERVAL_MS)
        }
      })
      .finally(() => this._isSavingInBackground = false)

    return this._saveInBackgroundQueue
  }

  get isSavingInBackground() {
    return this._isSavingInBackground
  }
}
