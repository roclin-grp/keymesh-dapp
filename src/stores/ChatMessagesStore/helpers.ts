
import {
  keys as proteusKeys,
  message as proteusMessage,
} from 'wire-webapp-proteus'

import {
  unixToday,
} from '../../utils/time'
import {
  uint8ArrayFromHex,
} from '../../utils/hex'
import {
  stringFromUint8Array,
  uint8ArrayFromString,
} from '../../utils/sodium'
import {
  generatePublicKeyFromHexStr,
} from '../../utils/proteus'

import {
  PreKeysPackage,
} from '../../PreKeysPackage'
import {
  Envelope,
  IEnvelopeHeader,
} from '../../Envelope'

import ENV from '../../config'

import {
  IRawUnpaddedMessage,
  IMessageSender,
} from './typings'
import { IMessage } from '../../databases/MessagesDB'
import { ISession } from '../../databases/SessionsDB'
import PreKeyBundle, { IPreKey } from '../../PreKeyBundle'

export async function generateEncryptedMessageEnvelope(
  sender: IMessageSender,
  session: ISession,
  message: IMessage,
  preKeyBundle: PreKeyBundle,
): Promise<Envelope> {
  const { cryptoBox } = sender
  const { sessionTag } = session

  const rawMessage: IRawUnpaddedMessage = {
    senderAddress: sender.userAddress,
    subject: session.data.subject,
    messageData: message.data,
  }

  const {
    result: paddedMessage,
    messageByteLength,
  } = padTo512Bytes(JSON.stringify(rawMessage))

  const encryptedMessage = await cryptoBox.encrypt(sessionTag, paddedMessage, preKeyBundle.serialise())

  const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)
  const proteusEncyptedMessage = proteusEnvelope.message
  const baseKey = getBaseKey(proteusEncyptedMessage)

  const header: IEnvelopeHeader = {
    senderIdentity: cryptoBox.identity.public_key,
    sessionTag,
    mac: proteusEnvelope.mac,
    baseKey,
    isPreKeyMessage: proteusEncyptedMessage instanceof proteusMessage.PreKeyMessage,
    messageByteLength,
  }
  const cipherMessage = getCipherMessage(proteusEncyptedMessage)

  return new Envelope(header, cipherMessage)
}

function getCipherMessage(message: proteusMessage.Message): proteusMessage.CipherMessage {
  if (message instanceof proteusMessage.CipherMessage) {
    return message
  }

  if (message instanceof proteusMessage.PreKeyMessage) {
    return message.message
  }

  throw new Error('Invalid message')
}

function getBaseKey(message: proteusMessage.Message): proteusKeys.PublicKey {
  if (message instanceof proteusMessage.CipherMessage) {
    const newKeyPair = proteusKeys.KeyPair.new()
    return newKeyPair.public_key
  }

  if (message instanceof proteusMessage.PreKeyMessage) {
    return message.base_key
  }

  throw new Error('Invalid message')
}

export function retoreEncryptedProteusMessagefromKeymeshEnvelope(
  envelope: Envelope,
  preKeyID: IPreKey['id'],
): proteusMessage.Message {
  const envelopeHeader = envelope.header
  if (envelopeHeader.isPreKeyMessage) {
    return proteusMessage.PreKeyMessage.new(
      preKeyID,
      envelopeHeader.baseKey,
      envelopeHeader.senderIdentity,
      envelope.cipherMessage,
    ) as any
  }

  return envelope.cipherMessage as any
}

export function padTo512Bytes(plaintext: string) {
  const typeArrayText = uint8ArrayFromString(plaintext)
  const messageByteLength = typeArrayText.byteLength
  if (messageByteLength >= 512) {
    throw new RangeError('Message too large')
  }
  const result = new Uint8Array(512).fill(0xFF)
  result.set(typeArrayText)
  return {
    result,
    messageByteLength,
  }
}

export function unpad512BytesMessage(padded512BytesMessage: Uint8Array, messageByteLength: number) {
  return stringFromUint8Array(padded512BytesMessage.subarray(
    0,
    messageByteLength,
  ))
}

export async function getPreKeysPackage(userAddress: string, identityFingerprint: string): Promise<PreKeysPackage> {
  const uploadPreKeysUrl = `${ENV.KVASS_ENDPOINT}${userAddress}`
  const fetchOptions: RequestInit = { method: 'GET', mode: 'cors' }
  const userPublicKey = generatePublicKeyFromHexStr(identityFingerprint)

  const resp = await fetch(uploadPreKeysUrl, fetchOptions)
  if (resp.status === 200) {
    const downloadedPreKeys = await resp.text()
    const [preKeysPackageSerializedStr, signature] = downloadedPreKeys.split(' ')
    if (preKeysPackageSerializedStr === '' || signature === '') {
      throw (new Error('the data is broken'))
    }

    if (!userPublicKey.verify(uint8ArrayFromHex(signature), preKeysPackageSerializedStr)) {
      throw (new Error('the prekeys\'s signature is invalid.'))
    }

    if (preKeysPackageSerializedStr !== '') {
      return PreKeysPackage.deserialize(uint8ArrayFromHex(preKeysPackageSerializedStr).buffer as ArrayBuffer)
    }
  }
  throw (new Error('status is not 200'))
}

export function getAvailablePreKey(preKeysPackage: PreKeysPackage): IPreKey {
  const {
    lastPrekeyDate,
    preKeyPublicKeys,
  } = preKeysPackage

  let preKeyID = unixToday()
  let preKeyPublicKeyFingerprint: string | undefined

  if (preKeyID < lastPrekeyDate) {
    const limitDay = preKeyID - preKeysPackage.interval
    while (preKeyID > limitDay) {
      preKeyPublicKeyFingerprint = preKeyPublicKeys[preKeyID]
      if (preKeyPublicKeyFingerprint != null) {
        break
      }
      preKeyID -= 1
    }
  }

  // If not found, use last-resort pre-key
  if (preKeyPublicKeyFingerprint == null) {
    preKeyID = lastPrekeyDate
    preKeyPublicKeyFingerprint = preKeyPublicKeys[lastPrekeyDate]
  }

  const publicKey = generatePublicKeyFromHexStr(preKeyPublicKeyFingerprint)
  return {
    id: preKeyID,
    publicKey,
  }
}

export async function getReceiverAvailablePrekey(address: string, identityKeyFingerprints: string): Promise<IPreKey> {
  const preKeyPackage = await getPreKeysPackage(address, identityKeyFingerprints)

  if (Object.keys(preKeyPackage.preKeyPublicKeys).length === 0) {
    throw new Error('no prekeys uploaded yet')
  }

  return getAvailablePreKey(preKeyPackage)
}
