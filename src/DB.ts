import Dexie from 'dexie'

import {
  ETHEREUM_NETWORKS,
} from './stores/EthereumStore'

import {
  Iuser,
  Icontact,
  USER_STATUS,
} from './stores/UserStore'

import { IsocialMedials, IbindingSocials, IboundSocials } from './stores/BoundSocialsStore'

import {
  dumpDB,
  dumpCryptobox,
  restoreDB,
  restoreCryptobox,
  IdumpedDatabases,
} from './utils/data'

import {
  Isession,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  Imessage,
} from './stores/SessionStore'

export default class DB {
  public constructor() {
    if (typeof indexedDB === 'undefined') {
      throw new Error(`IndexedDB isn't supported by your platform.`)
    }

    this.db = new Dexie('keymail')
    this.db.version(1).stores(SCHEMA_V1)
  }

  private readonly db: Dexie
  private get tableUsers(): TableUsers {
    return (this.db as any)[TABLE_NAMES.USERS]
  }
  private get tableSessions(): TableSessions {
    return (this.db as any)[TABLE_NAMES.SESSIONS]
  }
  private get tableMessages(): TableMessages {
    return (this.db as any)[TABLE_NAMES.MESSAGES]
  }
  public get tableSocialMedias(): TableSocialMedias {
    return (this.db as any)[TABLE_NAMES.SOCIAL_MEDIAS]
  }

  public createUser(user: IcreateUserArgs) {
    return this.tableUsers
      .add(Object.assign(
        {},
        {
          status: USER_STATUS.PENDING,
          blockHash: '0x0',
          lastFetchBlock: 0,
          lastFetchBlockOfBroadcast: 0,
          lastFetchBlockOfBoundSocials: 0,
          contacts: [],
          boundSocials: {},
          bindingSocials: {},
        },
        user
      ))
      .then(primaryKeys => this.tableUsers.get(primaryKeys)) as Dexie.Promise<Iuser>
  }

  public getUser(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return this.tableUsers
      .get([networkId, userAddress])
  }

  public getUsers(networkId: ETHEREUM_NETWORKS, status?: USER_STATUS) {
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

  public deleteUsers(networkId: ETHEREUM_NETWORKS) {
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
    const dbs: IdumpedDatabases = {}

    const keymailDB = await dumpDB(this.db)

    const usersTable = keymailDB.find((table) => table.table === TABLE_NAMES.USERS)
    if (typeof usersTable === 'undefined') {
      return dbs
    }

    dbs.keymail = keymailDB

    await Promise.all((usersTable.rows as Iuser[])
      .map(async (row) => {
        const db = await dumpCryptobox(row)
        dbs[db.dbname] = db.tables
      })
    )

    return dbs
  }

  public async restoreUserFromExportedData(networkId: ETHEREUM_NETWORKS, data: IdumpedDatabases) {
    const user = await this.db.transaction('rw', this.db.tables, async () => {
      const oldUsers = await this.getUsers(networkId)
      await restoreDB(this.db, data.keymail, () => undefined)
      const users = await this.getUsers(networkId)
      const oldUserAddress = oldUsers.reduce(
        (result, _user) => Object.assign(result, { [_user.userAddress]: true }),
        {} as {[userAddress: string]: boolean}
      )
      const newUser = users.find((_user) => !oldUserAddress[_user.userAddress])
      if (!newUser) {
        throw new Error('Network not match')
      }
      return newUser
    })
    delete data.keymail

    await Promise.all(
      Object.keys(data)
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )

    return user
  }

  public async restoreDB(data: IdumpedDatabases) {
    await restoreDB(this.db, data.keymail, (tablename: string): string[]|undefined => {
      return undefined
    })

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymail')
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )
  }
}

const SUMMARY_LENGTH = 32

enum TABLE_NAMES {
  USERS = 'users',
  SESSIONS = 'sessions',
  MESSAGES = 'messages',
  SOCIAL_MEDIAS = 'social_medias',
}

const SCHEMA_V1 = Object.freeze({
  [TABLE_NAMES.USERS]: '[networkId+userAddress], networkId, [networkId+status]',
  [TABLE_NAMES.SESSIONS]: '[sessionTag+userAddress], [networkId+userAddress], lastUpdate, contact.userAddress',
  [TABLE_NAMES.MESSAGES]:
    '[messageId+userAddress], [sessionTag+userAddress], sessionTag, [networkId+userAddress], timestamp',
  [TABLE_NAMES.SOCIAL_MEDIAS]: '[networkId+userAddress], bindingSocials, boundSocials, lastFetchBlock',
})

interface IcreateUserArgs {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identityTransactionHash: string
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

type TableUsers = Dexie.Table<Iuser, [ETHEREUM_NETWORKS, string]>
type TableSessions = Dexie.Table<Isession, [string, string]>
type TableMessages = Dexie.Table<Imessage, [string, string]>
export type TableSocialMedias = Dexie.Table<IsocialMedials, [ETHEREUM_NETWORKS, string]>
