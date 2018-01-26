const sodium = require('libsodium-wrappers-sumo')

export function isHexZeroValue(hexString: string) {
  return Number(hexString) === 0
}

export function utf8ToHex(str: string): string {
  return `0x${sodium.to_hex(sodium.from_string(str))}`
}

export function hexToUtf8(hex: string): string {
  return sodium.to_string(sodium.from_hex(hex))
}
