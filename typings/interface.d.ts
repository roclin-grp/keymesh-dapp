import {
  SOCIAL_MEDIA_PLATFORMS,
} from '../src/constants'

import {
  IboundSocials,
  IbindingSocials,
} from './proof.interface'

export interface IcreateAccountLifecycle {
  accountWillCreate?: () => void
  accountDidCreate?: () => void
}

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
