export interface IbroadcastMessage {
  message: string
  timestamp: number
}

export interface IsignedBroadcastMessage extends IbroadcastMessage {
  signature: string
}

export interface IreceviedBroadcastMessage extends IsignedBroadcastMessage {
  author: string
  isInvalidTimestamp: boolean
  blockTimestamp?: number // if isInvalidTimestamp is true, it will be filled
}
