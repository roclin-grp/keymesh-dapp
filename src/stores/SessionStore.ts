import {
  observable
} from 'mobx'
import {
  ItransactionLifecycle
} from './ContractStore'
import {
  UserStore,
  IuserIdentityKeys,
  Icontact,
} from './UserStore'

import {
  keys
} from 'wire-webapp-proteus'

import DB from '../DB'

export class SessionStore {
  @observable public session: Isession
  @observable.ref public messages: Imessage[] = []

  constructor(session: Isession, {
    db,
    userStore
  }: {
    db: DB,
    userStore: UserStore
  }) {
    // this.db = db
    this.session = this.sessionRef = session
  }

  private sessionRef: Isession
  // private db: DB
}

export interface Isession extends IuserIdentityKeys {
  sessionTag: string
  lastUpdate: number
  contact: Icontact
  subject: string
  isClosed: boolean
  unreadCount: number
  summary: string
}

export interface Imessage extends IuserIdentityKeys {
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

export interface ItrustbaseRawMessage {
  message: string
  timestamp: string
}

export interface IdecryptedTrustbaseMessage {
  decryptedPaddedMessage: Uint8Array
  senderIdentity: keys.IdentityKey
  timestamp: string
  messageByteLength: number
}

export interface IrawUnppaddedMessage {
  messageType: MESSAGE_TYPE
  timestamp: number
  subject: string
  fromUserAddress?: string
  plainText?: string
}

export interface IreceivedMessage extends IrawUnppaddedMessage {
  mac: Uint8Array
  sessionTag: string
  timestamp: number
  blockHash?: string
}

export interface IcheckMessageStatusLifecycle {
  sendingDidFail?: () => void
}

export interface IsendingLifecycle extends ItransactionLifecycle {
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
