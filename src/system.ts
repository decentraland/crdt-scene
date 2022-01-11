import { CRDT, crdtProtocol, Message } from "./crdt/index"
export { Message }

export interface SyncComponent<T = unknown> {
  put(state: T): void
  getSyncData(): string
  dirty?: boolean
}

declare var Symbol: any

export const isSyncComponent = (component: unknown): component is SynchronizableObservableComponent =>
  component instanceof SynchronizableObservableComponent

export class SynchronizableObservableComponent extends ObservableComponent implements SyncComponent<any> {
  dirty?: boolean
  data: any
  put(serialized: string): void {
    this.data = this.data || {}
    const state = JSON.parse(serialized)
    for (let key in state) {
      this.data[key] = state[key]
    }
    this.dirty = false
  }
  getSyncData(): string {
    return JSON.stringify(this.data)
  }
}

/**
 * 1. Cambio local, state="a", dirty=true
 * 2. Llega mensaje nuevo state="b", aplico put local, state="b", dirty=false
 */

export class CRDTSystem implements ISystem {
  cachedComponents: Record<string, Record<string, string> | undefined> = {}
  engine!: Engine
  crdt: CRDT<string>
  ws: WebSocket

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
    this.ws.onmessage = (event) => {
      this.processMessage(JSON.parse(event.data))
    }
    this.crdt = crdtProtocol<string>(async (message) => {
      this.ws.send(JSON.stringify(message))
    }, "client" + ((Math.random() * 100) | 0).toString())
  }

  activate(engine: Engine) {
    this.engine = engine
    engine.eventManager.addListener(ComponentAdded, this, this.componentAdded)
    engine.eventManager.addListener(ComponentRemoved, this, this.componentRemoved)
  }

  private componentRemoved(event: ComponentRemoved) {
    if (this.cachedComponents[event.entity.uuid]) {
      delete this.cachedComponents[event.entity.uuid]![event.componentName]
    }
  }

  private componentAdded(event: ComponentAdded) {
    if (event.entity.isAddedToEngine()) {
      const component = event.entity.components[event.componentName]

      if (!isSyncComponent(component)) {
        return
      }

      if (!this.cachedComponents[event.entity.uuid]) {
        this.cachedComponents[event.entity.uuid] = {}
      }

      this.cachedComponents[event.entity.uuid]![event.componentName] = component.getSyncData()
    }
  }

  update(dt: number) {
    this.syncComponents(dt)
  }

  onAddEntity(entity: Entity) {
    for (const componentName in entity.components) {
      const component = entity.components[componentName]

      if (!isSyncComponent(component)) {
        continue
      }

      if (!this.cachedComponents[entity.uuid]) {
        this.cachedComponents[entity.uuid] = {}
      }

      this.cachedComponents[entity.uuid]![componentName] = component.getSyncData()
    }
  }

  onRemoveEntity(entity: Entity) {
    delete this.cachedComponents[entity.uuid]
  }

  async processMessage(message: Message<string>) {
    await this.crdt.processMessage(message)
    const value = this.crdt.getState()[message.key]
    const [entityUUID, componentName] = this.parseKey(message)

    if (value?.data && value.data !== this.cachedComponents[entityUUID]![componentName]) {
      const component = this.engine.entities[entityUUID].components[componentName]

      if (isSyncComponent(component)) {
        this.cachedComponents[entityUUID]![componentName] = value.data
        component.put(value.data)
      }
    }
  }

  syncComponents(_dt: number) {
    for (const entityUUID in this.cachedComponents) {
      const entity = this.cachedComponents[entityUUID]
      for (const componentName in entity) {
        const component = this.engine.entities[entityUUID].components[componentName]

        if (!component || !isSyncComponent(component)) {
          continue
        }

        if (component.dirty) {
          const newVal = component.getSyncData()
          const key = this.getKey(entityUUID, componentName)

          if (!this.cachedComponents[entityUUID]) {
            this.cachedComponents[entityUUID] = {}
          }

          this.cachedComponents[entityUUID]![componentName] = newVal
          component.dirty = false
          void this.crdt.sendMessage(this.crdt.createEvent(key, newVal))
        }
      }
    }
  }

  getKey(entityUUID: string, componentName: string) {
    return `${entityUUID}.${componentName}`
  }

  parseKey(message: Message<string>): [string, string] {
    return message.key.split(".").slice(0, 2) as [string, string]
  }
}
