import {
  TypeDexieWithTables,
  Databases,
  IQuery,
} from './'

import {
  ISession, ISessionPrimaryKeys,
} from './SessionsDB'

import {
  IUser,
  IUserPrimaryKeys,
} from '../stores/UserStore'
import { hexFromUint8Array } from '../utils/hex'

export class MessagesDB {
  constructor(private dexieDB: TypeDexieWithTables, private dataBases: Databases) {}

  public getMessagesOfUser(user: IUser): Promise<IMessage[]> {
    const query: IUserPrimaryKeys & IQuery = {
      userAddress: user.userAddress,
      networkId: user.networkId,
    }

    return (
      this.dexieDB.messages
        .where(query)
        .toArray()
    )
  }

  public async getMessagesOfSession(session: ISession, options: IGetMessagesOptions = {}): Promise<IMessage[]> {
    const {
      timestampAfter,
      timestampBefore,
    } = options

    let dexieCollection = (
      this.dexieDB.messages
        .orderBy('data.timestamp')
        .reverse()
        .filter((message) =>
          message.sessionTag === session.sessionTag
          && message.userAddress === session.userAddress
          && (timestampAfter ? message.data.timestamp >= timestampAfter : true)
          && (timestampBefore ? message.data.timestamp < timestampBefore : true),
        )
    )

    const { offset = -1 } = options
    if (offset >= 0) {
      dexieCollection = dexieCollection.offset(offset)
    }

    const { limit = -1 } = options
    if (limit >= 0) {
      dexieCollection = dexieCollection.limit(limit)
    }

    const messages = await dexieCollection.toArray()

    return messages.reverse()
  }

  public async deleteMessagesOfUser(user: IUser, timestampBefore?: number) {
    const query: IUserPrimaryKeys & IQuery = {
      userAddress: user.userAddress,
      networkId: user.networkId,
    }

    let dexieCollection = this.dexieDB.messages.where(query)

    if (timestampBefore != null) {
      dexieCollection = dexieCollection.filter((message) => message.data.timestamp < timestampBefore)
    }

    await dexieCollection.delete()
  }

  public async deleteMessagesOfSession(session: ISession, options: IDeleteMessageOfSessionOptions = {}) {
    const {
      timestampBefore,
      isDeleteSession = false,
    } = options
    const {
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', sessions, messages, async () => {
      const query: ISessionPrimaryKeys & IQuery = {
        sessionTag: session.sessionTag,
        userAddress: session.userAddress,
      }

      let dexieCollection = this.dexieDB.messages.where(query)
      if (timestampBefore != null) {
        dexieCollection = dexieCollection.filter((message) => message.data.timestamp < timestampBefore)
      }

      if (isDeleteSession) {
        return dexieCollection.delete()
      }

      return dexieCollection.each((message) => this.deleteMessage(session, message))
    })
  }

  public addMessage(session: ISession, message: IMessage, options: IAddMessageOptions = {}) {
    const {
      messages,
    } = this.dexieDB

    return this.dexieDB.transaction('rw', this.dexieDB.sessions, messages, async () => {
      await messages.add(message)

      const { shouldAddUnread = !message.meta.isFromYourself } = options
      await this.updateSessionByMessageData(session, message, shouldAddUnread)
    })
  }

  public getMessage(messageID: IMessagePrimaryKeys['messageID']): Promise<IMessage | undefined> {
    return this.dexieDB.messages.get(messageID)
  }

  public async updateMessage(
    message: IMessage,
    options: IUpdateMessageOptions = {},
  ): Promise<IMessage> {
    const { messageID } = message
    const {
      messages,
    } = this.dexieDB

    const meta = {
      ...message.meta,
      options,
    }
    await messages.update(messageID, { meta })

    const updatedMessage = await messages.get(messageID)
    return updatedMessage!
  }

  public deleteMessage(session: ISession, message: IMessage) {
    const {
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB
      .transaction('rw', sessions, messages, async () => {
        await this.dexieDB.messages.delete(message.messageID)

        const remainMessages = await this.getMessagesOfSession(session)
        const remainMessagesCount = remainMessages.length
        const hasRemainMessages = remainMessagesCount > 0
        // if session has remain messages, use last message info to update it
        // otherwise, set to empty/default value
        await this.updateSessionByMessageData(
          session,
          hasRemainMessages ? remainMessages[remainMessagesCount - 1] : undefined,
        )
      })
  }

  public disposeDB() {
    return this.dexieDB.messages.clear()
  }

  private async updateSessionByMessageData(session: ISession, latestMessage?: IMessage, shouldAddUnread = false) {
    if (latestMessage == null) {
      await this.dataBases.sessionsDB.updateSession(
        session,
        {
          lastUpdate: Date.now(),
          summary: '',
          unreadCount: 0,
        },
      )
      return
    }

    const isClosed = latestMessage.data.messageType === MESSAGE_TYPE.CLOSE_SESSION
    const { payload } = latestMessage.data
    const summary = isClosed
      ? '[Session Closed]'
      : `${payload.slice(0, SUMMARY_LENGTH)}${(payload.length > SUMMARY_LENGTH ? '...' : '')}`

    await this.dataBases.sessionsDB.updateSession(
      session,
      {
        lastUpdate: latestMessage.data.timestamp,
        summary,
        isClosed,
        unreadCount: shouldAddUnread ? session.meta.unreadCount + 1 : session.meta.unreadCount,
      },
    )
  }
}

export function createMessage(
  session: ISession,
  data: IMessageData,
  messageID: IMessagePrimaryKeys['messageID'] = makeMessageID(),
  configMeta: IMessageConfigurableMeta = {},
): IMessage {
  const foreignKeys: IMessageForeignKeys = {
    userAddress: session.userAddress,
    networkId: session.networkId,
    sessionTag: session.sessionTag,
  }
  const defaultMeta: IMessageDefaultMeta = {
    isFromYourself: false,
    status: configMeta.isFromYourself ? MESSAGE_STATUS.DELIVERING : MESSAGE_STATUS.DELIVERED,
  }
  const meta = {
    ...defaultMeta,
    ...configMeta,
  }

  const message: IMessage = {
    messageID,
    ...foreignKeys,
    data,
    meta,
  }
  return message
}

export function makeMessageID() {
  return hexFromUint8Array(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))))
}

const SUMMARY_LENGTH = 32

export interface IMessagePrimaryKeys {
  messageID: string
}

export type IMessageForeignKeys = IUserPrimaryKeys & ISessionPrimaryKeys

export interface IMessageData {
  messageType: MESSAGE_TYPE
  timestamp: number
  payload: string
}

export interface IMessageConfigurableMeta {
  isFromYourself?: boolean
  status?: MESSAGE_STATUS
  transactionHash?: string
}

export interface IMessageDefaultData {
}

export interface IMessageDefaultMeta {
  status: MESSAGE_STATUS
  isFromYourself: boolean
}

export interface IMessage extends IMessagePrimaryKeys, IMessageForeignKeys {
  data: IMessageData & IMessageDefaultData
  meta: IMessageConfigurableMeta & IMessageDefaultMeta
}

export enum MESSAGE_TYPE {
  HELLO,
  NORMAL,
  CLOSE_SESSION,
}

export enum MESSAGE_STATUS {
  DELIVERING,
  DELIVERED,
  FAILED,
}

export interface IAddMessageOptions {
  shouldAddUnread?: boolean
}

interface IGetMessagesOptions {
  timestampAfter?: number
  timestampBefore?: number
  offset?: number
  limit?: number
}

interface IUpdateMessageOptions {
  status?: IMessage['meta']['status']
}

interface IDeleteMessageOfSessionOptions {
  timestampBefore?: number
  isDeleteSession?: boolean
}
