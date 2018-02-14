import Dexie from 'dexie'
import {
  UsersDB,
} from './UsersDB'
import {
  SessionsDB,
} from './SessionsDB'
import {
  MessagesDB,
} from './MessagesDB'

import {
  IUser,
} from '../stores/UserStore'
import {
  ISession,
} from '../stores/SessionStore'
import {
  IUserCaches,
} from '../stores/UserCachesStore'
import {
  IMessage,
} from '../stores/ChatMessageStore'

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
  if (typeof databases === 'undefined') {
    databases = new Databases()
  }
  return databases
}

export class Databases {
  public usersDB: UsersDB
  public sessionsDB: SessionsDB
  public messagesDB: MessagesDB
  public userCachesDB: UserCachesDB

  public constructor() {
    const dexieDB = this.dexieDB = new Dexie('keymesh') as TypeDexieWithTables
    dexieDB.version(1).stores(SCHEMA_V1)

    this.usersDB = new UsersDB(dexieDB, this)
    this.sessionsDB = new SessionsDB(dexieDB, this)
    this.messagesDB = new MessagesDB(dexieDB, this)
    this.userCachesDB = new UserCachesDB(dexieDB)
  }

  private readonly dexieDB: TypeDexieWithTables

  public async dumpDB() {
    const dbs: IDumpedDatabases = {}

    const keymeshDB = await dumpDB(this.dexieDB)

    const usersTable = keymeshDB.find((table) => table.table === TABLE_NAMES.USERS)
    if (typeof usersTable === 'undefined') {
      return dbs
    }

    dbs.keymesh = keymeshDB

    await Promise.all((usersTable.rows as IUser[])
      .map(async (row) => {
        const db = await dumpCryptobox(row)
        dbs[db.dbname] = db.tables
      })
    )

    return dbs
  }

  public async restoreDB(data: IDumpedDatabases) {
    await restoreDB(this.dexieDB, data.keymesh, (tablename: string): string[] | undefined => {
      return undefined
    })

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymesh')
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )
  }
}

enum TABLE_NAMES {
  USERS = 'users',
  SESSIONS = 'sessions',
  MESSAGES = 'messages',
  USER_CACHES = 'userCaches',
}

type TypeTableItems = {
  [TABLE_NAMES.USERS]: IUser
  [TABLE_NAMES.SESSIONS]: ISession
  [TABLE_NAMES.MESSAGES]: IMessage
  [TABLE_NAMES.USER_CACHES]: IUserCaches
}

type TypeTablePrimaryKeys = {
  [TABLE_NAMES.USERS]: [IUser['networkId'], IUser['userAddress']]
  [TABLE_NAMES.SESSIONS]: [ISession['sessionTag'], ISession['userAddress']]
  [TABLE_NAMES.MESSAGES]: [IMessage['messageId'], IMessage['userAddress']]
  [TABLE_NAMES.USER_CACHES]: [IUserCaches['networkId'], IUserCaches['userAddress']]
}

export type TypeTables = {
  [tablename in TABLE_NAMES]: Dexie.Table<TypeTableItems[tablename], TypeTablePrimaryKeys[tablename]>
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
  [TABLE_NAMES.SESSIONS]: '[sessionTag+userAddress], [networkId+userAddress], lastUpdate, contact.userAddress',
  [TABLE_NAMES.MESSAGES]:
    '[messageId+userAddress], [sessionTag+userAddress], sessionTag, [networkId+userAddress], timestamp',
  [TABLE_NAMES.USER_CACHES]: '[networkId+userAddress]',
})
