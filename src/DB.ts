import Dexie from 'dexie'

import {
  TableGlobalSettings,
  TableNetworkSettings,
  TableRegisterRecords,
  TableUsers,
  TableSessions,
  TableMessages,
  IglobalSettings,
  InetworkSettings,
  IregisterRecord,
  Iuser,
  Isession,
  Imessage,
} from '../typings/interface.d'

import {
  NETWORKS,
  TABLES,
  SCHEMA_V1,
  GLOBAL_SETTINGS_PRIMARY_KEY,
  MESSAGE_TYPE
} from './constants'

interface IcreateUserArgs {
  networkId: NETWORKS
  usernameHash: string
  username: string
  owner: string
}

interface IcreateSessionArgs {
  user: Iuser
  contact: string
  subject: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  plainText: string
  isFromYourself?: boolean
  fromUsername?: string
}

interface IgetSessionsOptions {
  contact?: string
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
  fromUsername?: string
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
  private get tableRegisterRecords(): TableRegisterRecords {
    return (this.db as any)[TABLES.REGISTER_RECORDS]
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

  public createRegisterRecord(record: IregisterRecord) {
    return this.tableRegisterRecords
      .add(record)
  }

  public getRegisterRecord(networkId: NETWORKS, usernameHash: string) {
    return this.tableRegisterRecords
      .get([networkId, usernameHash])
  }

  public getRegisterRecords(networkId: NETWORKS) {
    return this.tableRegisterRecords
      .where({networkId})
      .toArray()
  }

  public deleteRegisterRecord(networkId: NETWORKS, usernameHash: string) {
    return this.tableRegisterRecords
      .delete([networkId, usernameHash])
  }

  public deleteRegisterRecords(networkId: NETWORKS) {
    return this.tableRegisterRecords
      .where({networkId})
      .delete()
  }

  public clearRegisterRecords() {
    return this.tableRegisterRecords
      .clear()
  }

  public createUser(user: IcreateUserArgs) {
    return this.tableUsers
      .add(Object.assign({}, {
        lastFetchBlock: 0,
        contacts: []
      }, user))
  }

  public getUser(networkId: NETWORKS, usernameHash: string) {
    return this.tableUsers
      .get([networkId, usernameHash])
  }

  public getUsers(networkId: NETWORKS) {
    return this.tableUsers
      .where({networkId})
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
    contactUsername: string
  ) {
    if (contacts.includes(contactUsername)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, usernameHash], {
        contacts: contacts.concat(contactUsername)
      })
  }

  public deleteContact(
    {
      networkId,
      usernameHash,
      contacts
    }: Iuser,
    contactUsername: string
  ) {
    if (!contacts.includes(contactUsername)) {
      return Dexie.Promise.resolve(1)
    }
    return this.tableUsers
      .update([networkId, usernameHash], {
        contacts: contacts.
          filter((username) => username !== contactUsername)
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
    isFromYourself = false,
    fromUsername
  }: IcreateSessionArgs) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableSessions
        .add({
          sessionTag,
          networkId,
          usernameHash,
          contact,
          subject,
          lastUpdate: Date.now()
        })
      this.tableMessages
        .add({
          sessionTag,
          networkId,
          usernameHash,
          messageType,
          timestamp,
          plainText,
          isFromYourself,
          fromUsername
        })
      this.addContact(user, contact)
    })
  }

  public refreshSession(sessionTag: string) {
    return this.tableSessions
      .update(sessionTag, {
        lastUpdate: Date.now()
      })
  }

  public getSession(sessionTag: string) {
    return this.tableSessions
      .get(sessionTag)
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
            && contact ? session.contact === contact : true
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

  public deleteSession(
    user: Iuser,
    {
      sessionTag,
      contact
    }: Isession
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, async () => {
      await this.tableSessions
        .delete(sessionTag)
      await this.tableMessages
        .where({sessionTag})
        .delete()

      const remainSessions = await this.tableSessions
        .where({contact})
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
      fromUsername
    }: IcreateMessageArgs,
  ) {
    return this.db.transaction('rw', this.tableUsers, this.tableSessions, this.tableMessages, () => {
      this.tableMessages
        .add({
          networkId,
          usernameHash,
          sessionTag,
          messageType,
          timestamp,
          plainText,
          isFromYourself,
          fromUsername
        })
      this.refreshSession(sessionTag)
    })
  }

  public getMessage(sessionTag: string, timestamp: number) {
    return this.tableMessages
      .get([sessionTag, timestamp])
  }

  public getMessages(
    {
      networkId,
      usernameHash
    }: Iuser,
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
          message.networkId === networkId
          && message.usernameHash === usernameHash
          && timestampAfter ? message.timestamp >= timestampAfter : true
          && timestampBefore ? message.timestamp < timestampBefore : true
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
