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
  VerificationsDB,
} from './VerificationsDB'

import {
  ETHEREUM_NETWORKS,
} from '../stores/MetaMaskStore'
import {
  IUser,
} from '../stores/UserStore'
import {
  ISession,
  IMessage,
} from '../stores/SessionStore'
import {
  IVerifications,
} from '../stores/BoundSocialsStore'

import {
  dumpDB,
  dumpCryptobox,
  restoreDB,
  restoreCryptobox,
  IDumpedDatabases,
} from '../utils/data'

export class Databases {
  public usersDB: UsersDB
  public sessionsDB: SessionsDB
  public messagesDB: MessagesDB
  public verificationsDB: VerificationsDB

  public constructor() {
    if (typeof indexedDB === 'undefined') {
      throw new Error(`IndexedDB isn't supported by your platform.`)
    }

    const dexieDB = this.dexieDB = new Dexie('keymail')
    dexieDB.version(1).stores(SCHEMA_V1)

    const tables = {
      tableUsers: this.tableUsers,
      tableSessions: this.tableSessions,
      tableMessages: this.tableMessages,
      tableVerifications: this.tableVerifications,
    }
    this.usersDB = new UsersDB(tables, dexieDB, this)
    this.sessionsDB = new SessionsDB(tables, dexieDB, this)
    this.messagesDB = new MessagesDB(tables, dexieDB, this)
    this.verificationsDB = new VerificationsDB(tables, dexieDB, this)
  }

  private readonly dexieDB: Dexie
  private get tableUsers(): TypeTableUsers {
    return (this.dexieDB as any)[TABLE_NAMES.USERS]
  }
  private get tableSessions(): TypeTableSessions {
    return (this.dexieDB as any)[TABLE_NAMES.SESSIONS]
  }
  private get tableMessages(): TypeTableMessages {
    return (this.dexieDB as any)[TABLE_NAMES.MESSAGES]
  }
  private get tableVerifications(): TypeTableVerifications {
    return (this.dexieDB as any)[TABLE_NAMES.VERIFICATIONS]
  }

  public async dumpDB() {
    const dbs: IDumpedDatabases = {}

    const keymailDB = await dumpDB(this.dexieDB)

    const usersTable = keymailDB.find((table) => table.table === TABLE_NAMES.USERS)
    if (typeof usersTable === 'undefined') {
      return dbs
    }

    dbs.keymail = keymailDB

    await Promise.all((usersTable.rows as IUser[])
      .map(async (row) => {
        const db = await dumpCryptobox(row)
        dbs[db.dbname] = db.tables
      })
    )

    return dbs
  }

  public async restoreDB(data: IDumpedDatabases) {
    await restoreDB(this.dexieDB, data.keymail, (tablename: string): string[]|undefined => {
      return undefined
    })

    return Promise.all(
      Object.keys(data)
        .filter((dbname) => dbname !== 'keymail')
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )
  }
}

enum TABLE_NAMES {
  USERS = 'users',
  SESSIONS = 'sessions',
  MESSAGES = 'messages',
  VERIFICATIONS = 'verifications',
}

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
  [TABLE_NAMES.VERIFICATIONS]: '[networkId+userAddress]',
})

type TypeTableUsers = Dexie.Table<IUser, [ETHEREUM_NETWORKS, string]>
type TypeTableSessions = Dexie.Table<ISession, [string, string]>
type TypeTableMessages = Dexie.Table<IMessage, [string, string]>
type TypeTableVerifications = Dexie.Table<IVerifications, [ETHEREUM_NETWORKS, string]>

export interface ITables {
  tableUsers: TypeTableUsers
  tableSessions: TypeTableSessions
  tableMessages: TypeTableMessages
  tableVerifications: TypeTableVerifications
}
