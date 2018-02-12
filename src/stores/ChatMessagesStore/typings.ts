import {
  keys,
} from 'wire-webapp-proteus'
import {
  Cryptobox,
} from 'wire-webapp-cryptobox'

import {
  ITransactionLifecycle,
} from '../ContractStore'
import {
  IMessage,
  MESSAGE_TYPE,
} from '../ChatMessageStore'

export enum SENDING_FAIL_CODE {
  UNKNOWN = 0,
  NOT_CONNECTED = 400,
  INVALID_USER_ADDRESS = 401,
  INVALID_MESSAGE = 402,
  SEND_TO_YOURSELF = 403,
  INVALID_MESSAGE_TYPE = 404,
}

export interface ISender {
  cryptoBox: Cryptobox
  userAddress: string
}

export interface IReceiver {
  userAddress: string
  identityKey: keys.IdentityKey
  preKeyPublicKey: keys.PublicKey
  preKeyID: number
}

export interface IGenerateMessageOptions {
  closeSession?: boolean
  subject?: string
}

export interface ITrustbaseRawMessage {
  message: string
  timestamp: string
}

export interface IDecryptedTrustbaseMessage {
  decryptedPaddedMessage: Uint8Array
  senderIdentity: keys.IdentityKey
  timestamp: string
  messageByteLength: number
}

export interface IRawUnppaddedMessage {
  messageType: MESSAGE_TYPE
  timestamp: number
  subject?: string
  fromUserAddress?: string
  plainText?: string
}

export interface IReceivedMessage extends IRawUnppaddedMessage {
  mac: Uint8Array
  sessionTag: string
  timestamp: number
  blockHash?: string
}

export interface ISendLifecycle extends ITransactionLifecycle {
  messageDidCreate?: (message: IMessage) => void
  sendingDidFail?: (err: Error | null, code?: SENDING_FAIL_CODE) => void
}

export interface ISendMessageOptions extends ISendLifecycle {
  subject?: string
  plainText?: string
  sessionTag?: string
  closeSession?: boolean
}
