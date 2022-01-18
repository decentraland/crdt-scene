import { CRDT, Message, Payload, SendUpdates, State } from './types'
export * from './types'

/**
 * Compare raw data.
 * @internal
 */
function sameData<T = unknown>(a: T, b: T): boolean {
  if (a === b) return true

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.byteLength !== b.byteLength) {
      return false
    }

    for(let i = 0; i < a.byteLength; i++) {
      if (a[i] !== b[i]) {
        return false
      }
    }
    return true
  }

  return a === b
}

/**
 * @public
 * CRDT protocol.
 * Stores the latest state, and decides whenever we have
 * to process and store the new data in case its an update, or
 * to discard and send our local value cause remote it's outdated.
 */
export function crdtProtocol<T>(
  sendUpdates: SendUpdates<T>,
  id: string
): CRDT<T> {
  /**
   * UUID identifier
   * @internal
   */
  const uuid = id

  /**
   * Local state where we store the latest lamport timestamp
   * and the raw data value
   * @internal
   */
  const state: State<T> = {}

  /**
   * We should call this fn in order to update the state
   * @internal
   */
  function updateState(
    key: string,
    data: T,
    remoteTimestamp: number
  ): Payload<T> {
    const timestamp = Math.max(remoteTimestamp, state[key]?.timestamp || 0)

    return (state[key] = { timestamp, data })
  }

  /**
   * Create an event for the specified key and store the new data and
   * lamport timestmap incremented by one in the state.
   * @public
   */
  function createEvent(key: string, data: T): Message<T> {
    // Increment the timestamp
    const timestamp = (state[key]?.timestamp || 0) + 1
    updateState(key, data, timestamp)

    return { key, data, timestamp }
  }

  /**
   * Send generated message
   * @public
   */
  function sendMessage(message: Message<T>) {
    return sendUpdates(message)
  }

  /**
   * Process the received message only if the lamport number is higher than
   * the current one. If not, seems we have a race condition.
   * The bigger raw data wins and spreads it to the network
   * @public
   */
  async function processMessage(message: Message<T>) {
    const { key, data, timestamp } = message
    const current = state[key]

    // Somehow the message that we sent came back as an echo.
    if (sameData(current?.data, data)) {
      updateState(key, data, timestamp)
      return
    }

    // If the received timestamp is > than our current value, store it
    if (!current || current.timestamp < timestamp) {
      return updateState(key, data, timestamp).data
    }

    // If our current timestamp is higher, then send the message
    // to the network with our state
    if (current.timestamp > timestamp) {
      return sendMessage({
        key,
        data: current.data,
        timestamp: current.timestamp
      })
    }

    // if both timestamps are equal, then we have a race condition.
    // We should compare the raw data and the higher one wins.
    function compareData(current: unknown, data: unknown) {
      return (current as number) > (data as number)
    }

    if (compareData(current.data, data)) {
      return sendMessage({
        key,
        data: current.data,
        timestamp: current.timestamp
      })
    }
    return updateState(key, data, timestamp).data
  }

  /**
   * Returns the current state
   * @public
   */
  function getState(): State<T> {
    return { ...state } as State<T>
  }

  /**
   * Returns the client uuid
   * @public
   */
  function getUUID(): string {
    return uuid
  }

  return {
    createEvent,
    sendMessage,
    processMessage,
    getState,
    getUUID
  }
}
