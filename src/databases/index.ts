import Dexie, { IndexableType } from 'dexie'
import {
  UsersDB,
} from './UsersDB'
import {
  SessionsDB,
  ISession,
  ISessionPrimaryKeys,
} from './SessionsDB'
import {
  MessagesDB,
  IMessage,
  IMessagePrimaryKeys,
} from './MessagesDB'

import {
  IUser, IUserPrimaryKeys,
} from '../stores/UserStore'
import {
  IUserCaches,
} from '../stores/UserCachesStore'

import {
  dumpDB,
  dumpCryptobox,
  restoreDB,
  restoreCryptobox,
  IDumpedDatabases,
} from '../utils/data'
import { UserCachesDB } from './UserCachesDB'

let databases: Databases | undefined

export function getDatabases() {
  if (databases == null) {
    databases = new Databases()
  }
  return databases
}

export class Databases {
  public usersDB: UsersDB
  public sessionsDB: SessionsDB
  public messagesDB: MessagesDB
  public userCachesDB: UserCachesDB

  private readonly dexieDB: TypeDexieWithTables

  public constructor() {
    const dexieDB = this.dexieDB = new Dexie('keymesh') as TypeDexieWithTables
    dexieDB.version(1).stores(SCHEMA_V1)

    this.usersDB = new UsersDB(dexieDB, this)
    this.sessionsDB = new SessionsDB(dexieDB, this)
    this.messagesDB = new MessagesDB(dexieDB, this)
    this.userCachesDB = new UserCachesDB(dexieDB)
  }

  public async dumpDB() {
    const dbs: IDumpedDatabases = {}

    const keymeshDB = await dumpDB(this.dexieDB)

    const usersTable = keymeshDB.find((table) => table.table === TABLE_NAMES.USERS)
    if (usersTable == null) {
      return dbs
    }

    dbs.keymesh = keymeshDB

    await Promise.all((usersTable.rows as IUser[])
      .map(async (row) => {
        const db = await dumpCryptobox(row)
        dbs[db.dbname] = db.tables
      }),
    )

    return dbs
  }

  public async restoreDB(data: IDumpedDatabases) {
    await restoreDB(this.dexieDB, data.keymesh, () => undefined)

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymesh')
        .map((dbname) => restoreCryptobox(dbname, data[dbname])),
    )
  }
}

enum TABLE_NAMES {
  USERS = 'users',
  SESSIONS = 'sessions',
  MESSAGES = 'messages',
  USER_CACHES = 'userCaches',
}

interface ITableItems {
  [TABLE_NAMES.USERS]: IUser
  [TABLE_NAMES.SESSIONS]: ISession
  [TABLE_NAMES.MESSAGES]: IMessage
  [TABLE_NAMES.USER_CACHES]: IUserCaches
}

interface ITablePrimaryKeys {
  [TABLE_NAMES.USERS]: [IUserPrimaryKeys['networkId'], IUserPrimaryKeys['userAddress']]
  [TABLE_NAMES.SESSIONS]: [ISessionPrimaryKeys['sessionTag'], ISessionPrimaryKeys['userAddress']]
  [TABLE_NAMES.MESSAGES]: IMessagePrimaryKeys['messageID']
  [TABLE_NAMES.USER_CACHES]: [IUserCaches['networkId'], IUserCaches['userAddress']]
}

export type TypeTables = {
  [tablename in TABLE_NAMES]: Dexie.Table<ITableItems[tablename], ITablePrimaryKeys[tablename]>
}

export type TypeDexieWithTables = Dexie & TypeTables

// TODO: improve typings
/**
 * NOTE: here only specify table's index properties (for search optimization),
 * and only types list below can be use as index:
 *
 * string | number | Date | ArrayBuffer | ArrayBufferView | DataView
 * | Array<Array<void>>;
 */
const SCHEMA_V1 = Object.freeze({
  [TABLE_NAMES.USERS]: '[networkId+userAddress], networkId, [networkId+status]',
  [TABLE_NAMES.SESSIONS]:
    '[sessionTag+userAddress]'
    + ', '
    + '[networkId+userAddress]'
    + ', '
    + 'meta.lastUpdate'
    + ', '
    + 'data.contact',
  [TABLE_NAMES.MESSAGES]:
    'messageID'
    + ', '
    + '[networkId+userAddress]'
    + ', '
    + '[sessionTag+userAddress]'
    + ', '
    + 'data.timestamp',
  [TABLE_NAMES.USER_CACHES]: '[networkId+userAddress]',
})

export interface IQuery {[key: string]: IndexableType}
