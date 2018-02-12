import {
  keys,
  message,
} from 'wire-webapp-proteus'
const ed2curve = require('ed2curve')
const {
  Envelope,
} = message

import { sodiumFromHex } from './hex'

export function generatePublicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = sodiumFromHex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return keys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve
  )
}

export function generateIdentityKeyFromHexStr(identityKeyHexString: string) {
  return keys.IdentityKey.new(generatePublicKeyFromHexStr(identityKeyHexString))
}

export function getEmptyProteusEnvelope() {
  const emptyEnvelope = Object.create(Envelope.prototype)
  emptyEnvelope.version = 1
  return emptyEnvelope as message.Envelope
}
