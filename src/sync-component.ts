interface SyncComponent<T = unknown> {
  sync(state: T): void
  getSyncData(): string
  isSync: boolean
  shouldSync: boolean
}

export const isSyncComponent = (component: unknown): component is (SyncComponent & ObservableComponent) =>
  !!(component as SyncComponent).isSync

@Component("syncstate")
export class StateSyncComponent<K extends string, T = unknown> implements SyncComponent {
  isSync: boolean = true
  shouldSync: boolean = false
  state: Record<K, T>
  onChange: (state: Record<K, T>) => void

  constructor(state: Record<K, T>, onChange: (state: Record<K, T>) => void) {
    this.state = state
    this.onChange = onChange
  }

  set(state: Record<K, T>) {
    this.shouldSync = true
    this.state = state
    this.onChange(state)
  }

  get(key?: K) {
    return key ? this.state[key] : this.state
  }

  sync(state: Record<K, T>) {
    this.state = state
    this.onChange(state)
  }

  getSyncData() {
    return JSON.stringify(this.state)
  }
}
