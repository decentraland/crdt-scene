export function textEncode(value: unknown): Uint8Array {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  return new Uint8Array(stringValue.split('').map(c => c.charCodeAt(0)))
}

export function textDecode(value: ArrayBufferLike): string {
  return new Uint8Array(value).reduce((acc, char) => acc + String.fromCharCode(char), '');
}

export interface SyncComponent {
  put(state: Uint8Array): void
  getSyncData(): Uint8Array
  dirty?: boolean
}

export const isSyncComponent = (component: unknown): component is SynchronizableObservableComponent =>
  component instanceof SynchronizableObservableComponent

export class SynchronizableObservableComponent extends ObservableComponent implements SyncComponent {
  dirty?: boolean
  data: any

  put(serialized: Uint8Array): void {
    this.data = this.data || {}
    const state = JSON.parse(textDecode(serialized))
    for (let key in state) {
      this.data[key] = state[key]
    }
    this.dirty = false
  }

  getSyncData(): Uint8Array {
    return textEncode(this.data)
  }
}