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
} from '../typings/interface.d'

import {
  NETWORKS,
  TABLES,
  SCHEMA_V1,
  GLOBAL_SETTINGS_PRIMARY_KEY,
  MESSAGE_TYPE,
  SUMMARY_LENGTH,
  USER_STATUS
} from './constants'

interface IcreateUserArgs {
  networkId: NETWORKS
  usernameHash: string
  username: string
  owner: string
}

interface IcreateSessionArgs {
  user: Iuser
  contact: Icontact
  subject: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  summary: string
  plainText?: string
  isFromYourself?: boolean
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
  messageType: MESSAGE_TYPE
  sessionTag: string
  timestamp: number
  plainText: string
  isFromYourself?: boolean
  shouldAddUnread?: boolean
}

interface IgetMessagesOptions {
  timestampAfter?: number
  timestampBefore?: number
  offset?: number
  limit?: number
}

export default class DB {
  private db: Dexie
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

  constructor() {
    if (typeof indexedDB === 'undefined') {
      throw new Error(`IndexedDB isn't supported by your platform.`)
    }

    this.db = new Dexie('keymail')
    this.db.version(1).stores(SCHEMA_V1)
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
      .add(Object.assign({}, {
        lastFetchBlock: 0,
        contacts: [],
        status: USER_STATUS.PENDING,
        registerRecord,
        blockHash: '0x0'
      }, user))
  }

  public getUser(networkId: NETWORKS, usernameHash: string) {
    return this.tableUsers
      .get([networkId, usernameHash])
  }

  public getUsers(networkId: NETWORKS, status?: USER_STATUS) {
    return this.tableUsers
      .where(Object.assign({networkId}, status === undefined ? null : {status}))
      .toArray()
  }

  public deleteUser({
    networkId,
    usernameHash
  }: Iuser) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableUsers
        .delete([networkId, usernameHash])

      this.tableSessions
        .where({networkId, usernameHash})
        .delete()

      this.tableMessages
        .where({networkId, usernameHash})
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

  public updateUserAddUploadPreKeysTxHash(
    {
      networkId,
      usernameHash,
    }: Iuser,
    transactionHash?: string
  ) {
    return this.tableUsers
      .update([networkId, usernameHash], {
        uploadPreKeysTransactionHash: transactionHash
      })
  }

  public updateUserStatus(
    {
      networkId,
      usernameHash,
      blockHash
    }: Iuser,
    status: USER_STATUS
  ) {
    return this.tableUsers
      .update([networkId, usernameHash], Object.assign(
        {status},
        status === USER_STATUS.IDENTITY_UPLOADED ? {blockHash} : null,
        status === USER_STATUS.OK ? {registerRecord: undefined, uploadPreKeysTransactionHash: undefined} : null,
      ))
  }

  public updateLastFetchBlock(
    {
      networkId,
      usernameHash,
    }: Iuser,
    lastFetchBlock: number
  ) {
    return this.tableUsers
      .update([networkId, usernameHash], {lastFetchBlock})
  }

  public addContact(
    {
      networkId,
      usernameHash,
      contacts
    }: Iuser,
    contact: Icontact
  ) {
    if (contacts.find((_contact) => _contact.usernameHash === contact.usernameHash)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, usernameHash], {
        contacts: contacts.concat(contact)
      })
  }

  public deleteContact(
    {
      networkId,
      usernameHash,
      contacts
    }: Iuser,
    contact: Icontact
  ) {
    if (!contacts.find((_contact) => _contact.usernameHash === contact.usernameHash)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, usernameHash], {
        contacts: contacts.
          filter((_contact) => _contact.usernameHash !== contact.usernameHash)
      })
  }

  public deleteContacts(
    {
      networkId,
      usernameHash
    }: Iuser,
  ) {
    return this.tableUsers
      .update([networkId, usernameHash], {
        contacts: []
      })
  }

  public createSession({
    user: {
      networkId,
      usernameHash
    },
    user,
    contact,
    subject,
    sessionTag,
    messageType,
    timestamp,
    plainText,
    summary,
    isFromYourself = false
  }: IcreateSessionArgs) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableSessions
        .add({
          sessionTag,
          networkId,
          usernameHash,
          contact,
          summary,
          subject,
          lastUpdate: timestamp * 1000,
          unreadCount: isFromYourself ? 0 : 1,
          isClosed: false
        })
      this.tableMessages
        .add({
          sessionTag,
          networkId,
          usernameHash,
          messageType,
          timestamp,
          plainText,
          isFromYourself
        })
      this.addContact(user, contact)
    })
  }

  public clearSessionUnread(session: Isession) {
    return this.tableSessions
      .update([session.sessionTag, session.usernameHash], {
        unreadCount: 0
      })
  }

  public getSession(sessionTag: string, usernameHash: string) {
    return this.tableSessions
      .get([sessionTag, usernameHash])
  }

  public getSessions(
    {
      networkId,
      usernameHash
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
            && session.usernameHash === usernameHash
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
    usernameHash
  }: Isession) {
    return this.tableSessions
      .update([sessionTag, usernameHash], {
        isClosed: true
      })
  }

  public deleteSession(
    user: Iuser,
    {
      sessionTag,
      usernameHash,
      contact
    }: Isession
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, async () => {
      await this.tableSessions
        .delete([sessionTag, usernameHash])
      await this.tableMessages
        .where({sessionTag})
        .delete()

      const remainSessions = await this.tableSessions
        .where({'contact.usernameHash': contact.usernameHash})
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
      usernameHash
    } = user
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableSessions
        .where(Object.assign({
          networkId,
          usernameHash
        }, contact ? {contact} : null))
        .filter((session) => lastUpdateBefore ? session.lastUpdate < lastUpdateBefore : true)
        .each((session) => this.deleteSession(user, session))
    })
  }

  public createMessage(
    {
      user: {
        networkId,
        usernameHash
      },
      messageType,
      sessionTag,
      timestamp,
      plainText,
      isFromYourself = false,
      shouldAddUnread = true
    }: IcreateMessageArgs,
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, async () => {
      this.tableMessages
        .add({
          networkId,
          usernameHash,
          sessionTag,
          messageType,
          timestamp,
          plainText,
          isFromYourself
        })
      if (!isFromYourself && shouldAddUnread) {
        const session = await this.getSession(sessionTag, usernameHash) as Isession
        this.tableSessions
          .update([sessionTag, usernameHash], {
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
        .update([sessionTag, usernameHash], {
          lastUpdate: timestamp * 1000,
          summary,
        })
    })
  }

  public getMessage(sessionTag: string, timestamp: number) {
    return this.tableMessages
      .get([sessionTag, timestamp])
  }

  public getMessages(
    sessionTag: string,
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

  public deleteMessage({
    sessionTag,
    timestamp
  }: Imessage) {
    return this.tableMessages
      .delete([sessionTag, timestamp])
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
}
