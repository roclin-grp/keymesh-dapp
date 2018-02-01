import Dexie from 'dexie'
const sodium = require('libsodium-wrappers-sumo')

import {
  IUser,
} from '../stores/UserStore'
import { sodiumFromHex } from './hex'

const CRYPTOBOX_SCHEMA = Object.freeze({
  keys: '',
  prekeys: '',
  sessions: ''
})

export async function dumpCryptobox({
  networkId,
  userAddress
}: IUser
) {
  const dbname = `cryptobox@${networkId}@${userAddress}`
  const db = new Dexie(dbname)
  db.version(1).stores(CRYPTOBOX_SCHEMA)
  return {dbname, tables: await dumpDB(db)}
}

export function restoreCryptobox(dbname: string, tables: IDumpedTable[]) {
  const db = new Dexie(dbname)
  db.version(1).stores(CRYPTOBOX_SCHEMA)

  tables = tables.map((t) => {
    t.rows = t.rows.map((row) => {
      if (row.serialised) {
        row.serialised = sodiumFromHex(row.serialised).buffer
      }
      return row
    })
    return t
  })

  return restoreDB(db, tables, (tablename: string): string[]|undefined => {
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
  getKeysFunc: (tablename: string) => string[] | undefined,
) {
  return db.transaction('rw', db.tables, () => {
    return Promise.all(data.map((t) => db.table(t.table)
      .bulkAdd(t.rows, getKeysFunc(t.table))))
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

export interface IDumpedDatabases {
  [dbname: string]: IDumpedTable[]
}

export interface IDumpedTable {
  table: string
  rows: any[]
}
