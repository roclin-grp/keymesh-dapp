const ed2curve = require('ed2curve')
const sodium = require('libsodium-wrappers-sumo')
import { keys  } from 'wire-webapp-proteus'

export function publicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = sodium.from_hex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return keys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve
  )
}
