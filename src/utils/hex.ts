const sodium = require('libsodium-wrappers-sumo')

import {
  stringFromUint8Array,
  uint8ArrayFromString,
} from './sodium'

export function isHexZeroValue(hexString: string) {
  return Number(hexString) === 0
}

export function utf8ToHex(str: string): string {
  return hexFromUint8Array(uint8ArrayFromString(str))
}

export function hexToUtf8(hex: string): string {
  return stringFromUint8Array(uint8ArrayFromHex(hex))
}

export function uint8ArrayFromHex(hex: string): Uint8Array {
  return sodium.from_hex(hex.startsWith('0x') ? hex.slice(2) : hex)
}

export function hexFromUint8Array(data: Uint8Array): string {
  return `0x${sodium.to_hex(data)}`
}
