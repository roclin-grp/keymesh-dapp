const sodium = require('libsodium-wrappers-sumo')

export function uint8ArrayFromString(str: string): Uint8Array {
  return sodium.from_string(str)
}

export function stringFromUint8Array(str: Uint8Array): string {
  return sodium.to_string(str)
}

export function cryptoBoxSealOpen(
  data: Uint8Array,
  publicKeyCurve: Uint8Array,
  secretKeyCurve: Uint8Array,
): Uint8Array {
  return sodium.crypto_box_seal_open(
    data,
    publicKeyCurve,
    secretKeyCurve,
    'uint8array',
  )
}

export function cryptoBoxSeal(data: Uint8Array, publicKeyCurve: Uint8Array): ArrayBuffer {
  return sodium.crypto_box_seal(data, publicKeyCurve)
}
