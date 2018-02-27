import {
  TypeDexieWithTables,
  Databases,
  IQuery,
} from './'
import {
  IMessageData,
  IMessagePrimaryKeys,
  IAddMessageOptions,
  IMessage,
} from './MessagesDB'

import {
  IUser,
  IUserPrimaryKeys,
} from '../stores/UserStore'
import { hexFromUint8Array } from '../utils/hex'

export class SessionsDB {
  constructor(private dexieDB: TypeDexieWithTables, private dataBases: Databases) {}

  public getSessions(user: IUser, options: IGetSessionsOptions = {}): Promise<ISession[]> {
    const {
      contact,
    } = options

    let dexieCollection = (
      this.dexieDB.sessions
        .orderBy('meta.lastUpdate')
        .reverse()
        .filter((session) => {
          const userForeignKeys: IUserPrimaryKeys = {
            userAddress: session.userAddress,
            networkId: session.networkId,
          }

          return (
            userForeignKeys.networkId === user.networkId
            && userForeignKeys.userAddress === user.userAddress
            && (contact ? session.data.contact === contact : true)
          )
        })
    )

    const { offset = -1 } = options
    if (offset >= 0) {
      dexieCollection = dexieCollection.offset(offset)
    }

    const { limit = -1 } = options
    if (limit >= 0) {
      dexieCollection = dexieCollection.limit(limit)
    }

    return dexieCollection.toArray()
  }

  public deleteSessions(user: IUser, options: IDeleteSessionsOptions = {}) {
    const {
      lastUpdateBefore,
      contact,
      isDeleteUser = false,
    } = options

    const {
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', sessions, messages, () => {
      const query: IUserPrimaryKeys & IQuery = {
        userAddress: user.userAddress,
        networkId: user.networkId,
        ...(contact ? { 'data.contact': contact } : null),
      }

      let dexieCollection = sessions.where(query)

      if (lastUpdateBefore != null) {
        dexieCollection = dexieCollection
          .filter((session) => lastUpdateBefore ? session.meta.lastUpdate < lastUpdateBefore : true)
      }

      if (isDeleteUser) {
        dexieCollection.delete()
        return
      }

      return dexieCollection.each((session) => this.deleteSession(session))
    })
  }

  /**
   * prefer save session with first message, avoid empty session exist
   */
  public addSession(
    session: ISession,
    firstMessage?: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    const {
      sessions,
    } = this.dexieDB

    return this.dexieDB.transaction('rw', sessions, this.dexieDB.messages, async () => {
      await sessions.add(session)

      if (firstMessage != null) {
        await this.dataBases.messagesDB.addMessage(
          session,
          firstMessage,
          addMessageOptions,
        )
      }
    })
  }

  public getSession(
    sessionTag: ISessionPrimaryKeys['sessionTag'],
    userAddress: ISessionPrimaryKeys['userAddress'],
  ): Promise<ISession | undefined> {
    return this.dexieDB.sessions.get([sessionTag, userAddress])
  }

  public async updateSession(
    session: ISession,
    options: IUpdateSessionOptions = {},
  ): Promise<ISession> {
    const {
      sessionTag,
      userAddress,
    } = session
    const { sessions } = this.dexieDB

    const {
      summary,
      ...optionsMeta,
    } = options
    const meta = {
      ...session.meta,
      ...optionsMeta,
    }
    const data = {
      ...session.data,
      summary,
    }

    await sessions.update([sessionTag, userAddress], { meta, data })

    const updatedSession = await sessions.get([sessionTag, userAddress])

    return updatedSession!
  }

  public deleteSession(session: ISession) {
    const { sessions } = this.dexieDB

    return this.dexieDB.transaction('rw', sessions, this.dexieDB.messages, async () => {
      await sessions.delete([session.sessionTag, session.userAddress])
      await this.dataBases.messagesDB.deleteMessagesOfSession(session, { isDeleteSession: true })
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

export function createSession(
  user: IUser,
  sessionData: ISessionData,
  sessionTag: ISessionPrimaryKeys['sessionTag'] = makeSessionTag(),
  sessionMeta: ISessionConfigurableMeta = {},
): ISession {
  const foreignKeys: ISessionForeignKeys = {
    userAddress: user.userAddress,
    networkId: user.networkId,
  }
  const defaultData: ISessionDefaultData = {
  }
  const data = {
    ...defaultData,
    ...sessionData,
  }
  const defaultMeta: ISessionDefaultMeta = {
    lastUpdate: 0,
    unreadCount: 0,
    isClosed: false,
  }
  const meta = {
    ...defaultMeta,
    ...sessionMeta,
  }

  const session: ISession = {
    sessionTag,
    ...foreignKeys,
    data,
    meta,
  }

  return session
}

export function makeSessionTag() {
  return hexFromUint8Array(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))))
}

export interface ISessionPrimaryKeys {
  sessionTag: string
  userAddress: ISessionForeignKeys['userAddress']
}

export type ISessionForeignKeys = IUserPrimaryKeys

export interface ISessionData {
  contact: string
  subject?: string
  summary?: string
}

export interface ISessionDefaultData {
}

export interface ISessionConfigurableMeta {
}

export interface ISessionDefaultMeta {
  lastUpdate: number
  isClosed: boolean
  unreadCount: number
}

export interface ISession extends ISessionPrimaryKeys, ISessionForeignKeys {
  data: ISessionData & ISessionDefaultData
  meta: ISessionConfigurableMeta & ISessionDefaultMeta
}

interface IGetSessionsOptions {
  contact?: ISession['data']['contact']
  offset?: number
  limit?: number
}

interface IDeleteSessionsOptions {
  lastUpdateBefore?: number
  contact?: ISession['data']['contact']
  isDeleteUser?: boolean
}

export interface IUpdateSessionOptions {
  lastUpdate?: ISession['meta']['lastUpdate']
  isClosed?: ISession['meta']['isClosed']
  unreadCount?: ISession['meta']['unreadCount']
  summary?: ISession['data']['summary']
}

export interface ICreatSessionFirstMessageArgs {
  messageID: IMessagePrimaryKeys['messageID']
  data: IMessageData,
  options?: IAddMessageOptions,
}
