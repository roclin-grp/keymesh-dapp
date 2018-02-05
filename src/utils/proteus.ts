import { keys } from 'wire-webapp-proteus'
import { sodiumFromHex } from './hex'
const ed2curve = require('ed2curve')

export function generatePublicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = sodiumFromHex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return keys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve
  )
}
