import {
  keys,
  message,
} from 'wire-webapp-proteus'
const ed2curve = require('ed2curve')
const {
  Envelope,
} = message

import { uint8ArrayFromHex } from './hex'

export function generatePublicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = uint8ArrayFromHex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return keys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve
  )
}

export function generateIdentityKeyFromHexStr(identityKeyHexString: string) {
  return keys.IdentityKey.new(generatePublicKeyFromHexStr(identityKeyHexString))
}

export function getEmptyProteusEnvelope(): message.Envelope {
  const emptyEnvelope = Object.create(Envelope.prototype)
  emptyEnvelope.version = 1
  return emptyEnvelope
}

export function getPublicKeyFingerPrint(key: keys.IdentityKey | keys.PublicKey) {
  return `0x${key.fingerprint()}`
}
