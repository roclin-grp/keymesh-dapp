import {
  observable
} from 'mobx'
import {
  ITransactionLifecycle
} from './ContractStore'
import {
  UserStore,
  IUserIdentityKeys,
  IContact,
} from './UserStore'

import {
  keys
} from 'wire-webapp-proteus'

import {
  Databases,
} from '../databases'

export class SessionStore {
  @observable public session: ISession
  @observable.ref public messages: IMessage[] = []

  constructor(session: ISession, {
    databases,
    userStore
  }: {
    databases: Databases,
    userStore: UserStore
  }) {
    // this.databases = databases
    this.session = this.sessionRef = session
  }

  private sessionRef: ISession
  // private databases: Databases
}

export interface ISession extends IUserIdentityKeys {
  sessionTag: string
  lastUpdate: number
  contact: IContact
  subject: string
  isClosed: boolean
  unreadCount: number
  summary: string
}

export interface IMessage extends IUserIdentityKeys {
  messageId: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  plainText?: string
  transactionHash?: string
  status: MESSAGE_STATUS
}

export enum MESSAGE_TYPE {
  HELLO = 0,
  NORMAL = 1,
  CLOSE_SESSION = 2
}

export enum MESSAGE_STATUS {
  DELIVERING = 0,
  DELIVERED = 1,
  FAILED = 2
}

export const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
  [MESSAGE_STATUS.DELIVERED]: 'Delivered',
}) as {
  [messageStatus: number]: string
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
  subject: string
  fromUserAddress?: string
  plainText?: string
}

export interface IReceivedMessage extends IRawUnppaddedMessage {
  mac: Uint8Array
  sessionTag: string
  timestamp: number
  blockHash?: string
}

export interface ICheckMessageStatusLifecycle {
  sendingDidFail?: () => void
}

export interface ISendingLifecycle extends ITransactionLifecycle {
  sendingDidComplete?: () => void
  sendingDidFail?: (err: Error | null, code?: SENDING_FAIL_CODE) => void
}

export enum SENDING_FAIL_CODE {
  UNKNOWN = 0,
  NOT_CONNECTED = 400,
  INVALID_USER_ADDRESS = 401,
  INVALID_MESSAGE = 402,
  SEND_TO_YOURSELF = 403,
}
