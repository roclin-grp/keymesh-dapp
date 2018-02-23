import Dexie from 'dexie'
import {
  TypeDexieWithTables,
  Databases,
} from './'

import {
  IUser,
  IContact,
} from '../stores/UserStore'
import {
  ISession,
} from '../stores/SessionStore'
import {
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../stores/ChatMessageStore'

export class SessionsDB {
  constructor(private dexieDB: TypeDexieWithTables, private dataBases: Databases) {
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
      let _collect = this.dexieDB.sessions
        .orderBy('lastUpdate')
        .reverse()
        .filter((session) =>
          session.networkId === networkId
          && session.userAddress === userAddress
          && (contact ? session.contact === contact : true),
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
    }: IDeleteSessionsOptions = {},
  ) {
    const {
      networkId,
      userAddress,
    } = user
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', users, sessions, messages, () => {
      return sessions
        .where(Object.assign(
          {
            networkId,
            userAddress,
          },
          contact ? { contact } : null),
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
      subject = '',
      // first message
      messageId,
      messageType,
      timestamp,
      plainText,
      isFromYourself,
      transactionHash,
      status,
    }: ICreateSessionArgs,
  ) {
    const {
      networkId,
      userAddress,
    } = user
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB
      .transaction('rw', users, sessions, messages, async () => {
        await sessions
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

        await this.dataBases.messagesDB.createMessage(
          session,
          {
            messageId,
            messageType,
            timestamp,
            plainText,
            isFromYourself,
            transactionHash,
            status,
          },
        )

        await this.dataBases.usersDB.addContact(user, contact)

        return [sessionTag, user.userAddress] as [string, string]
      })
      .then((primaryKeys) => sessions.get(primaryKeys)) as Dexie.Promise<ISession>
  }

  public getSession(sessionTag: string, userAddress: string) {
    return this.dexieDB.sessions
      .get([sessionTag, userAddress])
  }

  public updateSession(
    {
      sessionTag,
      userAddress,
    }: ISession,
    updateSessionOptions: IUpdateSessionOptions = {},
  ) {
    const {
      sessions,
    } = this.dexieDB
    return sessions
      .update([sessionTag, userAddress], updateSessionOptions)
      .then(() => sessions.get([sessionTag, userAddress])) as Dexie.Promise<ISession>
  }

  public deleteSession(session: ISession) {
    const {
      sessionTag,
      userAddress,
      contact,
      networkId,
    } = session
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    const {
      messagesDB,
      usersDB,
    } = this.dataBases
    return this.dexieDB.transaction('rw', users, sessions, messages, async () => {
      await sessions
        .delete([sessionTag, userAddress])

      await messagesDB.deleteMessagesOfSession(session)

      const remainSessions = await sessions
        .where({ 'contact.userAddress': contact.userAddress })
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
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', sessions, messages, async () => {
      await Promise.all([
        sessions.clear(),
        messages.clear(),
      ])
    })
  }
}

export interface ICreateSessionArgs {
  sessionTag: string
  subject?: string
  contact: IContact
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

export interface IUpdateSessionOptions {
  lastUpdate?: number
  isClosed?: boolean
  unreadCount?: number
  summary?: string
}
