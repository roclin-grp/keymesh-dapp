import Dexie from 'dexie'
import {
  ITables,
  Databases,
} from './'

import {
  IUser,
  IContact,
} from '../stores/UserStore'
import {
  ISession,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../stores/SessionStore'

export class SessionsDB {
  constructor(private tables: ITables, private dexieDB: Dexie, private dataBases: Databases) {
    //
  }

  public getSessions(
    {
      networkId,
      userAddress,
    }: IUser,
    {
      contact,
      offset,
      limit,
    }: IGetSessionsOptions = {}) {
      const collect = (() => {
        let _collect = this.tables.tableSessions
          .orderBy('lastUpdate')
          .reverse()
          .filter((session) =>
            session.networkId === networkId
            && session.userAddress === userAddress
            && (contact ? session.contact === contact : true)
          )
        if (offset >= 0) {
          _collect = _collect.offset(offset)
        }
        if (limit >= 0) {
          _collect = _collect.limit(limit)
        }
        return _collect
      })()
      return collect.toArray()
  }

  public deleteSessions(
    user: IUser,
    {
      lastUpdateBefore,
      contact,
    }: IDeleteSessionsOptions = {}
  ) {
    const {
      networkId,
      userAddress,
    } = user
    const {
      tableUsers,
      tableSessions,
      tableMessages,
    } = this.tables
    return this.dexieDB.transaction('rw', tableUsers, tableSessions, tableMessages, () => {
      return tableSessions
        .where(Object.assign(
          {
            networkId,
            userAddress,
          },
          contact ? {contact} : null)
        )
        .filter((session) => lastUpdateBefore ? session.lastUpdate < lastUpdateBefore : true)
        .each((session) => this.deleteSession(session))
    })
  }

  public createSession(
    user: IUser,
    {
      // session
      sessionTag,
      contact,
      subject,
      // first message
      messageId,
      messageType,
      timestamp,
      plainText,
      isFromYourself,
      transactionHash,
      status,
    }: ICreateSessionArgs
  ) {
    const {
      networkId,
      userAddress,
    } = user
    const {
      tableUsers,
      tableSessions,
      tableMessages,
    } = this.tables
    const {
      usersDB,
      messagesDB,
    } = this.dataBases
    return this.dexieDB
      .transaction('rw', tableUsers, tableSessions, tableMessages, async () => {
        await tableSessions
          .add({
            sessionTag,
            userAddress,
            networkId,
            contact,
            subject,
            summary: '',
            lastUpdate: 0,
            unreadCount: 0,
            isClosed: false,
          })

        const session = await this.getSession(sessionTag, userAddress)

        if (typeof session === 'undefined') {
          throw new Error('session not exist')
        }

        await messagesDB.createMessage(
          session,
          {
            messageId,
            messageType,
            timestamp,
            plainText,
            isFromYourself,
            transactionHash,
            status,
          }
        )

        await usersDB.addContact(user, contact)

        return [sessionTag, user.userAddress] as [string, string]
      })
      .then((primaryKeys) => tableSessions.get(primaryKeys)) as Dexie.Promise<ISession>
  }

  public getSession(sessionTag: string, userAddress: string) {
    return this.tables.tableSessions
      .get([sessionTag, userAddress])
  }

  public updateSession(
    {
      sessionTag,
      userAddress,
    }: ISession,
    updateSessionOptions: IUpdateSessionOptions = {}
  ) {
    const {
      tableSessions,
    } = this.tables
    return tableSessions
      .update([sessionTag, userAddress], updateSessionOptions)
      .then(() => tableSessions.get([sessionTag, userAddress])) as Dexie.Promise<ISession>
  }

  public deleteSession(session: ISession) {
    const {
      sessionTag,
      userAddress,
      contact,
      networkId,
    } = session
    const {
      tableUsers,
      tableSessions,
      tableMessages,
    } = this.tables
    const {
      messagesDB,
      usersDB,
    } = this.dataBases
    return this.dexieDB.transaction('rw', tableUsers, tableSessions, tableMessages, async () => {
      await tableSessions
        .delete([sessionTag, userAddress])

      await messagesDB.deleteMessagesOfSession(session)

      const remainSessions = await tableSessions
        .where({'contact.userAddress': contact.userAddress})
        .toArray()

      if (remainSessions.length === 0) {
        const user = await usersDB.getUser(networkId, userAddress)
        if (typeof user !== 'undefined') {
          await usersDB.deleteContact(user, contact)
        }
      }
    })
  }

  public disposeDB() {
    const {
      tableSessions,
      tableMessages,
    } = this.tables
    return this.dexieDB.transaction('rw', tableSessions, tableMessages, async () => {
      await Promise.all([
        tableSessions.clear(),
        tableMessages.clear(),
      ])
    })
  }
}

interface ICreateSessionArgs {
  messageId: string
  contact: IContact
  subject: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  plainText?: string
  isFromYourself?: boolean
  transactionHash?: string
  status?: MESSAGE_STATUS
}

interface IGetSessionsOptions {
  contact?: IContact
  offset?: number
  limit?: number
}

interface IDeleteSessionsOptions {
  lastUpdateBefore?: number
  contact?: string
}

interface IUpdateSessionOptions {
  lastUpdate?: number
  isClosed?: boolean
  unreadCount?: number
  summary?: string
}
