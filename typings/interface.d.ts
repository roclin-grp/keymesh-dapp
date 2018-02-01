export interface IBroadcastMessage {
  message: string
  timestamp: number
}

export interface ISignedBroadcastMessage extends IBroadcastMessage {
  signature: string
}

export interface IReceviedBroadcastMessage extends ISignedBroadcastMessage {
  author: string
  isInvalidTimestamp: boolean
  blockTimestamp?: number // if isInvalidTimestamp is true, it will be filled
}
