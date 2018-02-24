const sodium = require('libsodium-wrappers-sumo')
import {
  encode as base58Encode,
  decode as base58Decode,
} from 'bs58check'

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
  return sodium.from_hex(removeHexPrefix(hex))
}

export function hexFromUint8Array(data: Uint8Array): string {
  return `0x${sodium.to_hex(data)}`
}

export function hexToBase58(hex: string): string {
  return base58Encode(Buffer.from(removeHexPrefix(hex), 'hex'))
}

export function base58ToHex(base58Str: string): string {
  return `0x${base58Decode(base58Str).toString('hex')}`
}

export function removeHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex
}
