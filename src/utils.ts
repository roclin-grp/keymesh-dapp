import Dexie from 'dexie'
import { IDumpedTable } from '../typings/interface'
const sodium = require('libsodium-wrappers')

const CRYPTOBOX_TABLES = {
  LOCAL_IDENTITY: 'keys',
  PRE_KEYS: 'prekeys',
  SESSIONS: 'sessions'
}

const CRYPTOBOX_SCHEMA: { [key: string]: string; } = {}
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.LOCAL_IDENTITY] = ''
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.PRE_KEYS] = ''
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.SESSIONS] = ''

export async function dumpCryptobox(usernameHash: string) {
  const dbname = 'cryptobox@' + usernameHash
  const db = new Dexie(dbname)
  db.version(1).stores(CRYPTOBOX_SCHEMA)
  return {dbname, tables: await dumpDB(db)}
}

export async function restoreCryptobox(dbname: string, tables: IDumpedTable[]) {
  const db = new Dexie(dbname)
  db.version(1).stores(CRYPTOBOX_SCHEMA)

  tables = tables.map((t) => {
    t.rows = t.rows.map((row) => {
      if (row.serialised) {
        row.serialised = sodium.from_hex(row.serialised).buffer
      }
      return row
    })
    return t
  })

  return await restoreDB(db, tables, (tablename: string): string[]|undefined => {
    const t = tables.find((_t) => _t.table === tablename)
    if (t === undefined) {
      return undefined
    }
    return t.rows.map((row) => row.id)
  })
}

export function dumpDB(db: Dexie) {
  return db.transaction('r', db.tables, () => {
    return Promise.all(
      db.tables.map((table) => table.toArray()
        .then((rows) => {
          rows = rows.map((row) => {
            if (row.serialised) {
              row.serialised = sodium.to_hex(new Uint8Array(row.serialised))
            }
            return row
          })
          return { table: table.name, rows }
        })
      )
    )
  })
}

export function restoreDB(
  db: Dexie,
  data: IDumpedTable[],
  getKeysFunc: (tablename: string) => string[]|undefined,
) {
  return db.transaction('rw', db.tables, () => {
    return Promise.all(data.map((t) => db.table(t.table)
      .bulkAdd(t.rows, getKeysFunc(t.table) as any)))
  })
}

export function downloadObjectAsJson(exportObj: any, exportName: string) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj))
  const downloadAnchorNode = document.createElement('a')
  downloadAnchorNode.setAttribute('href', dataStr)
  downloadAnchorNode.setAttribute('download', exportName + '.json')
  downloadAnchorNode.click()
  downloadAnchorNode.remove()
}