import {
  keys as proteusKeys,
  message as proteusMessage,
} from 'wire-webapp-proteus'
const ed2curve = require('ed2curve')

import { uint8ArrayFromHex } from './hex'

export function generatePublicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = uint8ArrayFromHex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return proteusKeys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve,
  )
}

export function generateIdentityKeyFromHexStr(identityKeyHexString: string) {
  return proteusKeys.IdentityKey.new(generatePublicKeyFromHexStr(identityKeyHexString))
}

export function getEmptyProteusEnvelope(): proteusMessage.Envelope {
  const emptyEnvelope = Object.create(proteusMessage.Envelope.prototype)
  emptyEnvelope.version = 1
  return emptyEnvelope
}

export function getPublicKeyFingerPrint(key: proteusKeys.IdentityKey | proteusKeys.PublicKey) {
  return `0x${key.fingerprint()}`
}
