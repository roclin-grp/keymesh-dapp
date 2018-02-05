import Dexie from 'dexie'
import {
  ITables,
  Databases,
} from './'

import {
  IUser,
} from '../stores/UserStore'
import {
  ISession,
  IMessage,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../stores/SessionStore'

export class MessagesDB {
  constructor(private tables: ITables, private dexieDB: Dexie, private dataBases: Databases) {
    //
  }

  public getMessagesOfUser({userAddress, networkId}: IUser) {
    return this.tables.tableMessages
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
      offset,
      limit,
    }: IGetMessagesOptions = {}
  ) {
    const collect = (() => {
      let _collect = this.tables.tableMessages
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
    return this.tables.tableMessages
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
    return this.tables.tableMessages
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
      status = MESSAGE_STATUS.DELIVERING,
    }: ICreateMessageArgs,
  ) {
    const {
      networkId,
      userAddress,
      sessionTag,
    } = session
    const {
      tableSessions,
      tableMessages,
    } = this.tables
    const {
      sessionsDB,
    } = this.dataBases
    return this.dexieDB
      .transaction('rw', tableSessions, tableMessages, async () => {
        await tableMessages
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

        let summary: string = ''
        if (isClosed) {
          summary = 'Session closed'
        } else {
          plainText = plainText || ''
          summary = `${plainText.slice(0, SUMMARY_LENGTH)}${(plainText.length > SUMMARY_LENGTH ? '...' : '')}`
        }

        await sessionsDB.updateSession(session, Object.assign(
          {
            lastUpdate: timestamp,
            summary,
          },
          isClosed ? { isClosed: true } : null,
          !isFromYourself && shouldAddUnread ? { unreadCount: session.unreadCount + 1 } : null
        ))

        return [messageId, userAddress] as [string, string]
      })
      .then((primaryKeys) => tableMessages.get(primaryKeys)) as Dexie.Promise<IMessage>
  }

  public getMessage(messageId: string, userAddress: string) {
    return this.tables.tableMessages
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
      tableMessages,
    } = this.tables
    return tableMessages
      .update([messageId, userAddress], IupdateMessageArgs)
      .then(() => tableMessages.get([messageId, userAddress])) as Dexie.Promise<IMessage>
  }

  public deleteMessage({
    messageId,
    userAddress,
  }: IMessage) {
    return this.tables.tableMessages
      .delete([messageId, userAddress])
  }

  public disposeDB() {
    const {
      tableMessages,
    } = this.tables
    return this.dexieDB.transaction('rw', tableMessages, () => {
      return tableMessages.clear()
    })
  }
}

const SUMMARY_LENGTH = 32

interface ICreateMessageArgs {
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
