import Dexie from 'dexie'

const sodium = require('libsodium-wrappers-sumo')

import {
  IDumpedTable,
  Iuser
} from '../typings/interface'

const CRYPTOBOX_TABLES = {
  LOCAL_IDENTITY: 'keys',
  PRE_KEYS: 'prekeys',
  SESSIONS: 'sessions'
}

const CRYPTOBOX_SCHEMA: { [key: string]: string; } = {}
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.LOCAL_IDENTITY] = ''
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.PRE_KEYS] = ''
CRYPTOBOX_SCHEMA[CRYPTOBOX_TABLES.SESSIONS] = ''

export async function dumpCryptobox({
  networkId,
  userAddress
}: Iuser
) {
  const dbname = `cryptobox@${networkId}@${userAddress}`
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

const UNITS = [
  { max: 2760000, value: 60000, name: 'minute', prev: 'a minute ago' }, // max: 46 minutes
  { max: 72000000, value: 3600000, name: 'hour', prev: 'an hour ago' }, // max: 20 hours
  { max: Infinity, value: 86400000, name: '', prev: 'yesterday' }
]

export function formatSessionTimestamp(timestamp: number) {
  const diff = Math.abs(Date.now() - timestamp)

  if (diff < 60000) { // less than a minute
    return 'just now'
  }

  for (let i = 0; i < UNITS.length; i++) {
    const {
      max,
      value,
      name,
      prev
    } = UNITS[i]
    if (diff < max) {
      const val = Math.floor(diff / value)
      if (i < 2) {
        return val <= 1 ? prev : `${val} ${name}s ago`
      }
      if (val <= 1) {
        return prev
      }
      const time = new Date(timestamp)
      return `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`
    }
  }
  return ''
}

export function utf8ToHex(str: string): string {
  return `0x${sodium.to_hex(sodium.from_string(str))}`
}

export function hexToUtf8(hex: string): string {
  return sodium.to_string(sodium.from_hex(hex))
}
