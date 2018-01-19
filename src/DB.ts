import Dexie from 'dexie'

import {
  TableGlobalSettings,
  TableNetworkSettings,
  TableUsers,
  TableSessions,
  TableMessages,
  IglobalSettings,
  InetworkSettings,
  Iuser,
  Isession,
  Imessage,
  Icontact,
  IregisterRecord,
  IDumpedDatabases,
} from '../typings/interface.d'

import {
  NETWORKS,
  TABLES,
  SCHEMA_V1,
  GLOBAL_SETTINGS_PRIMARY_KEY,
  MESSAGE_TYPE,
  SUMMARY_LENGTH,
  USER_STATUS,
  MESSAGE_STATUS
} from './constants'
import { dumpDB, dumpCryptobox, restoreDB, restoreCryptobox } from './utils'
import { IboundSocials, IbindingSocials } from '../typings/proof.interface'

interface IcreateUserArgs {
  networkId: NETWORKS
  userAddress: string
}

interface IcreateSessionArgs {
  user: Iuser
  messageId: string
  contact: Icontact
  subject: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  summary: string
  plainText?: string
  isFromYourself?: boolean
  transactionHash?: string
  status: MESSAGE_STATUS
}

interface IgetSessionsOptions {
  contact?: Icontact
  offset?: number
  limit?: number
}

interface IdeleteSessionsOptions {
  lastUpdateBefore?: number
  contact?: string
}

interface IcreateMessageArgs {
  user: Iuser
  messageId: string
  messageType: MESSAGE_TYPE
  sessionTag: string
  timestamp: number
  plainText: string
  isFromYourself?: boolean
  shouldAddUnread?: boolean
  transactionHash?: string
  status: MESSAGE_STATUS
}

interface IgetMessagesOptions {
  timestampAfter?: number
  timestampBefore?: number
  offset?: number
  limit?: number
}

export default class DB {
  public constructor() {
    if (typeof indexedDB === 'undefined') {
      throw new Error(`IndexedDB isn't supported by your platform.`)
    }

    this.db = new Dexie('keymail')
    this.db.version(1).stores(SCHEMA_V1)
  }

  private readonly db: Dexie
  private get tableGlobalSettings(): TableGlobalSettings {
    return (this.db as any)[TABLES.GLOBAL_SETTINGS]
  }
  private get tableNetworkSettings(): TableNetworkSettings {
    return (this.db as any)[TABLES.NETWORK_SETTINGS]
  }
  private get tableUsers(): TableUsers {
    return (this.db as any)[TABLES.USERS]
  }
  private get tableSessions(): TableSessions {
    return (this.db as any)[TABLES.SESSIONS]
  }
  private get tableMessages(): TableMessages {
    return (this.db as any)[TABLES.MESSAGES]
  }

  public saveGlobalSettings(settings: IglobalSettings) {
    return this.tableGlobalSettings
      .put(settings, GLOBAL_SETTINGS_PRIMARY_KEY)
  }

  public getGlobalSettings() {
    return this.tableGlobalSettings
      .get(GLOBAL_SETTINGS_PRIMARY_KEY)
      .catch(() => undefined)
      .then((settings) => settings || {}) as Dexie.Promise<IglobalSettings>
  }

  public saveNetworkSettings(settings: InetworkSettings) {
    return this.tableNetworkSettings
      .put(settings)
  }

  public getNetworkSettings(networkId: NETWORKS) {
    return this.tableNetworkSettings
      .get(networkId)
      .then((settings) => settings || {networkId}) as Dexie.Promise<InetworkSettings>
  }

  public createUser(user: IcreateUserArgs, registerRecord?: IregisterRecord) {
    return this.tableUsers
      .add(Object.assign(
        {},
        {
          lastFetchBlock: 0,
          lastFetchBlockOfBroadcast: 0,
          lastFetchBlockOfBoundSocials: 0,
          contacts: [],
          status: USER_STATUS.PENDING,
          registerRecord,
          blockHash: '0x0',
          boundSocials: {},
          bindingSocials: {},
        },
        user
      ))
  }

  public getUser(networkId: NETWORKS, userAddress: string) {
    return this.tableUsers
      .get([networkId, userAddress])
  }

  public getUsers(networkId: NETWORKS, status?: USER_STATUS) {
    return this.tableUsers
      .where(Object.assign({networkId}, status === undefined ? null : {status}))
      .toArray()
  }

  public deleteUser({
    networkId,
    userAddress
  }: Iuser) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableUsers
        .delete([networkId, userAddress])

      this.tableSessions
        .where({networkId, userAddress})
        .delete()

      this.tableMessages
        .where({networkId, userAddress})
        .delete()
    })
  }

  public deleteUsers(networkId: NETWORKS) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableUsers
        .where({networkId})
        .each((user) => this.deleteUser(user))
    })
  }

  public clearUsers() {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableUsers.clear()
      this.tableSessions.clear()
      this.tableMessages.clear()
    })
  }

  public updateUserStatus(
    {
      networkId,
      userAddress,
      blockHash
    }: Iuser,
    status: USER_STATUS
  ) {
    return this.tableUsers
      .update([networkId, userAddress], Object.assign(
        {status},
        status === USER_STATUS.IDENTITY_UPLOADED ? {blockHash} : null,
        status === USER_STATUS.OK ? {registerRecord: undefined} : null,
      ))
  }
  public updateBindingSocials(
    {
      networkId,
      userAddress,
    }: Iuser,
    bindingSocials: IbindingSocials
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {bindingSocials})
  }

  public updateBoundSocials(
    {
      networkId,
      userAddress,
    }: Iuser,
    boundSocials: IboundSocials
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {boundSocials})
  }

  public updateLastFetchBlockOfBoundSocials(
    {
      networkId,
      userAddress,
    }: Iuser,
    lastFetchBlockOfBoundSocials: number
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {lastFetchBlockOfBoundSocials})
  }

  public updateLastFetchBlockOfBroadcast(
    {
      networkId,
      userAddress,
    }: Iuser,
    lastFetchBlockOfBroadcast: number
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {lastFetchBlockOfBroadcast})
  }

  public updateLastFetchBlock(
    {
      networkId,
      userAddress,
    }: Iuser,
    lastFetchBlock: number
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {lastFetchBlock})
  }

  public addContact(
    {
      networkId,
      userAddress,
      contacts
    }: Iuser,
    contact: Icontact
  ) {
    if (contacts.find((_contact) => _contact.userAddress === contact.userAddress)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, userAddress], {
        contacts: contacts.concat(contact)
      })
  }

  public deleteContact(
    {
      networkId,
      userAddress,
      contacts
    }: Iuser,
    contact: Icontact
  ) {
    if (!contacts.find((_contact) => _contact.userAddress === contact.userAddress)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, userAddress], {
        contacts: contacts.
          filter((_contact) => _contact.userAddress !== contact.userAddress)
      })
  }

  public deleteContacts(
    {
      networkId,
      userAddress
    }: Iuser,
  ) {
    return this.tableUsers
      .update([networkId, userAddress], {
        contacts: []
      })
  }

  public createSession({
    user: {
      networkId,
      userAddress
    },
    user,
    messageId,
    contact,
    subject,
    sessionTag,
    messageType,
    timestamp,
    plainText,
    summary,
    isFromYourself = false,
    transactionHash,
    status,
  }: IcreateSessionArgs) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableSessions
        .add({
          sessionTag,
          networkId,
          userAddress,
          contact,
          summary,
          subject,
          lastUpdate: timestamp,
          unreadCount: isFromYourself ? 0 : 1,
          isClosed: false
        })
      this.tableMessages
        .add({
          messageId,
          sessionTag,
          networkId,
          userAddress,
          messageType,
          timestamp,
          plainText,
          isFromYourself,
          transactionHash,
          status,
        })
      this.addContact(user, contact)
    })
  }

  public clearSessionUnread(session: Isession) {
    return this.tableSessions
      .update([session.sessionTag, session.userAddress], {
        unreadCount: 0
      })
  }

  public getSession(sessionTag: string, userAddress: string) {
    return this.tableSessions
      .get([sessionTag, userAddress])
  }

  public getSessions(
    {
      networkId,
      userAddress
    }: Iuser,
    {
      contact,
      offset,
      limit,
    }: IgetSessionsOptions = {}) {
      const collect = (() => {
        let _collect = this.tableSessions
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

  public closeSession({
    sessionTag,
    userAddress
  }: Isession) {
    return this.tableSessions
      .update([sessionTag, userAddress], {
        isClosed: true
      })
  }

  public deleteSession(
    user: Iuser,
    {
      sessionTag,
      userAddress,
      contact
    }: Isession
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, async () => {
      await this.tableSessions
        .delete([sessionTag, userAddress])
      await this.tableMessages
        .where({sessionTag, userAddress})
        .delete()

      const remainSessions = await this.tableSessions
        .where({'contact.userAddress': contact.userAddress})
        .toArray()
      if (remainSessions.length === 0) {
        await this.deleteContact(user, contact)
      }
    })
  }

  public deleteSessions(
    user: Iuser,
    {
      lastUpdateBefore,
      contact
    }: IdeleteSessionsOptions = {}
  ) {
    const {
      networkId,
      userAddress
    } = user
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableSessions
        .where(Object.assign(
          {
            networkId,
            userAddress
          },
          contact ? {contact} : null)
        )
        .filter((session) => lastUpdateBefore ? session.lastUpdate < lastUpdateBefore : true)
        .each((session) => this.deleteSession(user, session))
    })
  }

  public createMessage(
    {
      user: {
        networkId,
        userAddress
      },
      messageId,
      messageType,
      sessionTag,
      timestamp,
      plainText,
      isFromYourself = false,
      shouldAddUnread = true,
      transactionHash = '',
      status,
    }: IcreateMessageArgs,
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, async () => {
      this.tableMessages
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
      if (!isFromYourself && shouldAddUnread) {
        const session = await this.getSession(sessionTag, userAddress) as Isession
        this.tableSessions
          .update([sessionTag, userAddress], {
            unreadCount: session.unreadCount + 1
          })
      }

      let summary: string = ''
      if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
        summary = 'Session closed'
      } else {
        summary = `${
          (isFromYourself ? 'Me: ' : '')
        }${
          plainText.slice(0, SUMMARY_LENGTH)
        }${
          (plainText.length > SUMMARY_LENGTH ? '...' : '')
        }`
      }
      this.tableSessions
        .update([sessionTag, userAddress], Object.assign(
          {
            lastUpdate: timestamp,
            summary,
          },
          messageType === MESSAGE_TYPE.CLOSE_SESSION ? { isClosed: true } : null
        ))
    })
  }

  public getMessage(messageId: string, userAddress: string) {
    return this.tableMessages
      .get([messageId, userAddress])
  }

  public getUserMessages({userAddress, networkId}: Iuser) {
    return this.tableMessages.where({userAddress, networkId}).toArray()
  }

  public getMessages(
    sessionTag: string,
    userAddress: string,
    {
      timestampAfter,
      timestampBefore,
      offset,
      limit,
    }: IgetMessagesOptions = {}
  ) {
    const collect = (() => {
      let _collect = this.tableMessages
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

  public updateMessageStatus({ messageId, userAddress }: Imessage, status: MESSAGE_STATUS) {
    return this.tableMessages.update([messageId, userAddress], {status})
  }

  public deleteMessage({
    messageId,
    userAddress
  }: Imessage) {
    return this.tableMessages
      .delete([messageId, userAddress])
  }

  public deleteMessages(
    {
      sessionTag
    }: Isession,
    timestampBefore?: number
  ) {
    return this.tableMessages
      .where({sessionTag})
      .filter((message) => timestampBefore ? message.timestamp < timestampBefore : true)
      .delete()
  }

  public async dumpDB() {
    const dbs: IDumpedDatabases = {}

    const keymailDB = await dumpDB(this.db)

    const users = keymailDB.find((table) => table.table === TABLES.USERS)
    if (users === undefined) {
      return
    }

    dbs.keymail = keymailDB

    await Promise.all((users.rows as Iuser[])
      .map(async (row) => {
        const db = await dumpCryptobox(row)
        dbs[db.dbname] = db.tables
      })
    )

    return dbs
  }

  public async restoreDumpedUser(_data: string) {
    const data: IDumpedDatabases = JSON.parse(_data)
    await restoreDB(this.db, data.keymail, (): string[]|undefined => {
      return undefined
    })

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymail')
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )
  }

  public async restoreDB(_data: string) {
    const data: IDumpedDatabases = JSON.parse(_data)
    await restoreDB(this.db, data.keymail, (tablename: string): string[]|undefined => {
      if (tablename === 'global-settings') {
        return []
      }
      return undefined
    })

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymail')
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )
  }
}
