import Dexie from 'dexie'
import {
  TypeDexieWithTables,
  Databases,
} from './'

import {
  IUpdateSessionOptions,
} from './SessionsDB'

import {
  IUser,
} from '../stores/UserStore'
import {
  ISession,
} from '../stores/SessionStore'
import {
  IMessage,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../stores/ChatMessageStore'

export class MessagesDB {
  constructor(private dexieDB: TypeDexieWithTables, private dataBases: Databases) {
    //
  }

  public getMessagesOfUser({userAddress, networkId}: IUser) {
    return this.dexieDB.messages
      .where({userAddress, networkId})
      .toArray()
  }

  public getMessagesOfSession(
    {
      sessionTag,
      userAddress,
    }: ISession,
    {
      timestampAfter,
      timestampBefore,
      offset = -1,
      limit = -1,
    }: IGetMessagesOptions = {}
  ) {
    const collect = (() => {
      let _collect = this.dexieDB.messages
        .orderBy('timestamp')
        .reverse()
        .filter((message) =>
          message.sessionTag === sessionTag
          && message.userAddress === userAddress
          && (timestampAfter ? message.timestamp >= timestampAfter : true)
          && (timestampBefore ? message.timestamp < timestampBefore : true)
        )
      if (offset >= 0) {
        _collect = _collect.offset(offset)
      }
      if (limit >= 0) {
        _collect = _collect.limit(limit)
      }
      return _collect
    })()
    return collect.toArray().then((arr) => arr.reverse())
  }

  public deleteMessagesOfUser(
    {
      networkId,
      userAddress,
    }: IUser,
    timestampBefore?: number
  ) {
    return this.dexieDB.messages
      .where({networkId, userAddress})
      .filter((message) => timestampBefore ? message.timestamp < timestampBefore : true)
      .delete()
  }

  public deleteMessagesOfSession(
    {
      sessionTag,
    }: ISession,
    timestampBefore?: number
  ) {
    return this.dexieDB.messages
      .where({sessionTag})
      .filter((message) => timestampBefore ? message.timestamp < timestampBefore : true)
      .delete()
  }

  public createMessage(
    session: ISession,
    {
      messageId,
      messageType,
      timestamp,
      plainText,
      isFromYourself = false,
      shouldAddUnread = true,
      transactionHash = '',
      status = MESSAGE_STATUS.DELIVERED,
    }: ICreateMessageArgs,
  ) {
    const {
      networkId,
      userAddress,
      sessionTag,
    } = session
    const {
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB
      .transaction('rw', sessions, messages, async () => {
        await messages
          .add({
            messageId,
            networkId,
            userAddress,
            sessionTag,
            messageType,
            timestamp,
            plainText,
            isFromYourself,
            transactionHash,
            status,
          })

        const isClosed = messageType === MESSAGE_TYPE.CLOSE_SESSION

        let summary = ''
        if (isClosed) {
          summary = 'Session closed'
        } else {
          plainText = plainText || ''
          summary = `${plainText.slice(0, SUMMARY_LENGTH)}${(plainText.length > SUMMARY_LENGTH ? '...' : '')}`
        }

        await this.dataBases.sessionsDB.updateSession(
          session, Object.assign<IUpdateSessionOptions, IUpdateSessionOptions | null, IUpdateSessionOptions | null>(
          {
            lastUpdate: timestamp,
            summary,
          },
          isClosed ? { isClosed: true } : null,
          !isFromYourself && shouldAddUnread ? { unreadCount: session.unreadCount + 1 } : null
        ))

        return [messageId, userAddress] as [string, string]
      })
      .then((primaryKeys) => messages.get(primaryKeys)) as Dexie.Promise<IMessage>
  }

  public getMessage(messageId: string, userAddress: string) {
    return this.dexieDB.messages
      .get([messageId, userAddress])
  }

  public updateMessage(
    {
      messageId,
      userAddress,
    }: IMessage,
    IupdateMessageArgs: IUpdateMessageOptions = {}
  ) {
    const {
      messages,
    } = this.dexieDB
    return messages
      .update([messageId, userAddress], IupdateMessageArgs)
      .then(() => messages.get([messageId, userAddress])) as Dexie.Promise<IMessage>
  }

  public deleteMessage(session: ISession, {
    messageId,
    userAddress,
  }: IMessage) {
    const {
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB
      .transaction('rw', sessions, messages, async () => {
        await this.dexieDB.messages
          .delete([messageId, userAddress])

        const remainMessages = await this.getMessagesOfSession(session)
        const remainMessagesCount = remainMessages.length
        const hasRemainMessages = remainMessagesCount > 0
        let lastUpdate = 0
        let summary = ''
        if (hasRemainMessages) {
          const lastMessages = remainMessages[remainMessagesCount - 1]
          lastUpdate = lastMessages.timestamp
          const plainText = lastMessages.plainText || ''
          summary = `${plainText.slice(0, SUMMARY_LENGTH)}${(plainText.length > SUMMARY_LENGTH ? '...' : '')}`
        }

        await this.dataBases.sessionsDB.updateSession(session, {
          lastUpdate,
          summary,
        })
      })
  }

  public disposeDB() {
    const {
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', messages, () => {
      return messages.clear()
    })
  }
}

const SUMMARY_LENGTH = 32

export interface ICreateMessageArgs {
  messageId: string
  messageType: MESSAGE_TYPE
  timestamp: number
  plainText?: string
  status?: MESSAGE_STATUS
  isFromYourself?: boolean
  shouldAddUnread?: boolean
  transactionHash?: string
}

interface IGetMessagesOptions {
  timestampAfter?: number
  timestampBefore?: number
  offset?: number
  limit?: number
}

interface IUpdateMessageOptions {
  status?: MESSAGE_STATUS
}
