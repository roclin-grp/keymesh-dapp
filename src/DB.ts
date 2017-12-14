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
  Icontact,
} from '../typings/interface.d'

import {
  NETWORKS,
  TABLES,
  SCHEMA_V1,
  GLOBAL_SETTINGS_PRIMARY_KEY,
  MESSAGE_TYPE,
  SUMMARY_LENGTH,
  MESSAGE_STATUS
} from './constants'
import { session } from 'wire-webapp-proteus';

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

  public getRegisterRecord(networkId: NETWORKS, usernameHash: string): Dexie.Promise<IregisterRecord|undefined> {
    return this.tableRegisterRecords
      .get([networkId, usernameHash])
  }

  public getRegisterRecords(networkId: NETWORKS) {
    return this.tableRegisterRecords
      .where({networkId})
      .reverse()
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

  public updateMessageStatus({timestamp, sessionTag}: Imessage, status: MESSAGE_STATUS) {
    return this.tableMessages.update([sessionTag, timestamp], {status})
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
    isFromYourself = false,
    transactionHash,
    status,
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
          isFromYourself,
          transactionHash,
          status,
        })
      this.addContact(user, contact)
    })
  }

  public clearSessionUnread(session: Isession) {
    return this.tableSessions
      .update(session.sessionTag, {
        unreadCount: 0
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
    sessionTag
  }: Isession) {
    return this.tableSessions
      .update(sessionTag, {
        isClosed: true
      })
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
      shouldAddUnread = true,
      transactionHash = '',
      status,
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
          isFromYourself,
          transactionHash,
          status,
        })
      if (!isFromYourself && shouldAddUnread) {
        const session = await this.getSession(sessionTag) as Isession
        this.tableSessions
          .update(sessionTag, {
            unreadCount: session.unreadCount + 1
          })
      }

      let summary: string = ''
      if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
        summary = 'Session closed'
      } else {
        summary = (isFromYourself ? 'Me: ' : '') + plainText.slice(0, SUMMARY_LENGTH) + (plainText.length > SUMMARY_LENGTH ? '...' : '')
      }
      this.tableSessions
        .update(sessionTag, {
          lastUpdate: timestamp * 1000,
          summary: summary,
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
