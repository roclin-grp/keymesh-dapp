import {
  keys as proteusKeys,
  message as proteusMessage,
} from 'wire-webapp-proteus'
const ed2curve = require('ed2curve')

import { uint8ArrayFromHex } from './hex'
import { Envelope } from '../Envelope'
import { IPreKey } from '../PreKeyBundle'

export function publicKeyFromHexStr(publicKeyHexString: string): proteusKeys.PublicKey {
  const preKeyPublicKeyEd = uint8ArrayFromHex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return proteusKeys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve,
  )
}

export function identityKeyFromHexStr(identityKeyHexString: string): proteusKeys.IdentityKey {
  return proteusKeys.IdentityKey.new(publicKeyFromHexStr(identityKeyHexString))
}

export function publicKeyToIdentityKey(publicKey: proteusKeys.PublicKey): proteusKeys.IdentityKey {
  return proteusKeys.IdentityKey.new(publicKey)
}

export function getEmptyProteusEnvelope(): proteusMessage.Envelope {
  const emptyEnvelope = Object.create(proteusMessage.Envelope.prototype)
  emptyEnvelope.version = 1
  return emptyEnvelope
}

export function retoreProteusMessage(envelope: Envelope, preKeyID: IPreKey['id']): proteusMessage.Message {
  const envelopeHeader = envelope.header
  if (envelopeHeader.isPreKeyMessage) {
    return proteusMessage.PreKeyMessage.new(
      preKeyID,
      envelopeHeader.baseKey,
      envelopeHeader.senderIdentity,
      envelope.cipherMessage,
    ) as any
    // PreKeyMessage is a derived class of Message
    // but proteus's type definition is wrong
  }

  return envelope.cipherMessage as any
}

export function restoreProteusEnvelope(message: proteusMessage.Message, mac: Uint8Array): proteusMessage.Envelope {
  const proteusEnvelope = getEmptyProteusEnvelope()
  proteusEnvelope.mac = mac
  proteusEnvelope._message_enc = new Uint8Array(message.serialise())
  return proteusEnvelope
}

export function getPublicKeyFingerPrint(key: proteusKeys.IdentityKey | proteusKeys.PublicKey): string {
  return `0x${key.fingerprint()}`
}

export function getCipherMessageFromMessage(message: proteusMessage.Message): proteusMessage.CipherMessage {
  if (message instanceof proteusMessage.CipherMessage) {
    return message
  }

  if (message instanceof proteusMessage.PreKeyMessage) {
    return message.message
  }

  throw new Error('Invalid message')
}

export function getBaseKeyFromMessage(message: proteusMessage.Message): proteusKeys.PublicKey {
  if (message instanceof proteusMessage.CipherMessage) {
    const newKeyPair = proteusKeys.KeyPair.new()
    return newKeyPair.public_key
  }

  if (message instanceof proteusMessage.PreKeyMessage) {
    return message.base_key
  }

  throw new Error('Invalid message')
}

export function getPreKeyFromBundle(preKeyBundle: proteusKeys.PreKeyBundle): IPreKey {
  return {
    id: preKeyBundle.prekey_id,
    publicKey: preKeyBundle.public_key,
  }
}
