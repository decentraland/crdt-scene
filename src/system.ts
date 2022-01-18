import { CRDT, crdtProtocol, Message } from "./crdt/index"
import { isSyncComponent } from "./sync-component"
export { Message }

/**
 * Message helpers
 */
function parseData(value: any): Message<Uint8Array> | void {
  try {
    const msg = JSON.parse(value) as Message<Record<string, number>>
    const buff = Object.keys(msg.data).map(k => msg.data[k])
    const data = new Uint8Array(buff)
    return {
      key: msg.key,
      timestamp: msg.timestamp,
      data
    }
  } catch (_e) {}
  return
}

function getKey(entityUUID: string, componentName: string) {
  return `${entityUUID}.${componentName}`
}

function parseKey(message: Message<Uint8Array>): [string, string] {
  return message.key.split(".").slice(0, 2) as [string, string]
}


/**
 * CRDT System
 */
export class CRDTSystem implements ISystem {
  private cachedComponents: Record<string, Record<string, boolean> | undefined> = {}
  private engine!: Engine
  private crdt: CRDT<Uint8Array>
  private ws: WebSocket

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
    this.ws.onmessage = (event) => {
      const message = parseData(event.data)
      if (!message) return
      this.processMessage(message)
    }
    this.crdt = crdtProtocol<Uint8Array>(async (message) => {
      this.ws.send(JSON.stringify(message))
    }, "UUID:" + ((Math.random() * 100) | 0).toString())
  }

  activate(engine: Engine) {
    this.engine = engine
    engine.eventManager.addListener(ComponentAdded, this, this.componentAdded)
    engine.eventManager.addListener(ComponentRemoved, this, this.componentRemoved)
  }

  onAddEntity(entity: Entity) {
    for (const componentName in entity.components) {
      const component = entity.components[componentName]

      if (!isSyncComponent(component)) {
        continue
      }

      this.setCacheComponent(entity.uuid, componentName)
    }
  }

  private componentAdded(event: ComponentAdded) {
    if (event.entity.isAddedToEngine()) {
      const component = event.entity.components[event.componentName]

      if (!isSyncComponent(component)) {
        return
      }
      this.setCacheComponent(event.entity.uuid, event.componentName)
    }
  }

  onRemoveEntity(entity: Entity) {
    delete this.cachedComponents[entity.uuid]
  }

  private componentRemoved(event: ComponentRemoved) {
    if (this.cachedComponents[event.entity.uuid]) {
      delete this.cachedComponents[event.entity.uuid]![event.componentName]
    }
  }

  update(dt: number) {
    this.syncComponents(dt)
  }

  private setCacheComponent(entityUUID: string, componentName: string) {
    if (!this.cachedComponents[entityUUID]) {
      this.cachedComponents[entityUUID] = {}
    }

    this.cachedComponents[entityUUID]![componentName] = true
  }

  private async processMessage(message: Message<Uint8Array>) {
    const data = await this.crdt.processMessage(message)
    const [entityUUID, componentName] = parseKey(message)
    const component = this.engine.entities[entityUUID].components[componentName]

    if (data && isSyncComponent(component)) {
      component.put(data)
    }
  }

  private syncComponents(_dt: number) {
    for (const entityUUID in this.cachedComponents) {
      const entity = this.cachedComponents[entityUUID]
      for (const componentName in entity) {
        const component = this.engine.entities[entityUUID].components[componentName]

        if (!component || !isSyncComponent(component) || !component.dirty) {
          continue
        }

        const newVal = component.getSyncData()
        const key = getKey(entityUUID, componentName)
        component.dirty = false
        void this.crdt.sendMessage(this.crdt.createEvent(key, newVal))
      }
    }
  }
}
