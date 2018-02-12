
import {
  keys,
  message as proteusMessage,
} from 'wire-webapp-proteus'
const sodium = require('libsodium-wrappers-sumo')

import {
  MESSAGE_TYPE,
} from '../ChatMessageStore'

import {
  unixToday,
} from '../../utils/time'
import {
  generatePublicKeyFromHexStr,
} from '../../utils/proteus'

import {
  PreKeysPackage,
  IPreKeyPublicKeyFingerprints,
} from '../../PreKeysPackage'
import PreKeyBundle from '../../PreKeyBundle'
import {
  Envelope,
  IEnvelopeHeader,
} from '../../Envelope'

import {
  ISender,
  IReceiver,
  IGenerateMessageOptions,
  IRawUnppaddedMessage,
} from './typings'

export async function generateHelloMessage(
  {
    userAddress: fromUserAddress,
    cryptoBox,
  }: ISender,
  {
    identityKey,
    preKeyPublicKey,
    preKeyID,
  }: IReceiver,
  plainText: string,
  {
    closeSession = false,
    subject,
  }: IGenerateMessageOptions = {}
) {
  const messageType = closeSession ? MESSAGE_TYPE.CLOSE_SESSION : MESSAGE_TYPE.HELLO
  const timestamp = Date.now()
  const rawMessage: IRawUnppaddedMessage = {
    timestamp,
    subject,
    messageType,
    fromUserAddress,
    plainText,
  }

  const {
    result: paddedMessage,
    messageByteLength,
  } = padTo512Bytes(JSON.stringify(rawMessage))

  const preKeyBundle = PreKeyBundle.create(identityKey, preKeyPublicKey, preKeyID)

  const sessionTag = makeSessionTag()
  const encryptedMessage = await cryptoBox.encrypt(
    sessionTag,
    paddedMessage,
    preKeyBundle.serialise()
  )

  const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)
  const preKeyMessage: proteusMessage.PreKeyMessage = proteusEnvelope.message as any
  const cipherMessage = preKeyMessage.message
  const header: IEnvelopeHeader = {
    senderIdentity: cryptoBox.identity.public_key,
    mac: proteusEnvelope.mac,
    baseKey: preKeyMessage.base_key,
    sessionTag,
    isPreKeyMessage: true,
    messageByteLength,
  }

  return {
    messageType,
    sessionTag,
    envelope: new Envelope(header, cipherMessage),
    mac: proteusEnvelope.mac,
    timestamp,
  }
}

export async function generateNormalMessage(
  {
    userAddress: fromUserAddress,
    cryptoBox,
  }: ISender,
  plainText: string,
  sessionTag: string,
  {
    closeSession = false,
    subject,
  }: IGenerateMessageOptions = {}
) {
  const messageType = closeSession ? MESSAGE_TYPE.CLOSE_SESSION : MESSAGE_TYPE.NORMAL
  const timestamp = Date.now()
  const rawMessage: IRawUnppaddedMessage = {
    timestamp,
    subject,
    messageType,
    fromUserAddress,
    plainText,
  }
  const {
    result: paddedMessage,
    messageByteLength,
  } = padTo512Bytes(JSON.stringify(rawMessage))

  const encryptedMessage = await cryptoBox.encrypt(
    sessionTag,
    paddedMessage
  )

  const senderIdentity = cryptoBox.identity.public_key
  const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)

  let cipherMessage: proteusMessage.CipherMessage
  let header: IEnvelopeHeader
  if (proteusEnvelope.message instanceof proteusMessage.PreKeyMessage) {
    const preKeyMessage = proteusEnvelope.message
    cipherMessage = preKeyMessage.message
    header = {
      senderIdentity,
      mac: proteusEnvelope.mac,
      baseKey: preKeyMessage.base_key,
      isPreKeyMessage: true,
      sessionTag,
      messageByteLength,
    }
  } else {
    cipherMessage = proteusEnvelope.message as any
    header = {
      senderIdentity,
      mac: proteusEnvelope.mac,
      baseKey: keys.KeyPair.new().public_key, // generate a new one
      isPreKeyMessage: false,
      sessionTag,
      messageByteLength,
    }
  }

  return {
    messageType,
    sessionTag,
    envelope: new Envelope(header, cipherMessage),
    mac: proteusEnvelope.mac,
    timestamp,
  }
}

export function padTo512Bytes(plaintext: string) {
  const typeArrayText = sodium.from_string(plaintext)
  const messageByteLength: number = typeArrayText.byteLength
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
  return sodium.to_string(padded512BytesMessage.subarray(
    0,
    messageByteLength
  ))
}

export function makeSessionTag() {
  return `0x${sodium.to_hex(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))))}`
}

export async function getPreKeys(userAddress: string, identityFingerprint: string) {
  const uploadPreKeysUrl = process.env.REACT_APP_KVASS_ENDPOINT + userAddress
  const init = { method: 'GET', mode: 'cors' } as RequestInit
  const userPublicKey = generatePublicKeyFromHexStr(identityFingerprint.slice(2))

  const resp = await fetch(uploadPreKeysUrl, init)
  if (resp.status === 200) {
    const downloadedPreKeys = await resp.text()
    const [preKeysPackageSerializedStr, signature] = downloadedPreKeys.split(' ')
    if (preKeysPackageSerializedStr === '' || signature === '') {
      throw (new Error('the data is broken'))
    }

    if (!userPublicKey.verify(sodium.from_hex(signature.slice(2)), preKeysPackageSerializedStr)) {
      throw (new Error('the prekeys\'s signature is invalid.'))
    }

    if (preKeysPackageSerializedStr !== '') {
      return PreKeysPackage.deserialize(sodium.from_hex(preKeysPackageSerializedStr.slice(2)).buffer)
    }
  }
  throw (new Error('status is not 200'))
}

export function getPreKey({
  interval,
  lastPrekeyDate,
  preKeyPublicKeyFingerprints,
}: {
  interval: number,
  lastPrekeyDate: number,
  preKeyPublicKeyFingerprints: IPreKeyPublicKeyFingerprints
}) {
  let preKeyPublicKeyFingerprint
  let preKeyID = unixToday()
  if (preKeyID > lastPrekeyDate) {
    preKeyID = lastPrekeyDate
    preKeyPublicKeyFingerprint = preKeyPublicKeyFingerprints[preKeyID]
  } else {
    const limitDay = preKeyID - interval
    while (preKeyID > limitDay && preKeyPublicKeyFingerprint === undefined) {
      preKeyPublicKeyFingerprint = preKeyPublicKeyFingerprints[preKeyID]
      preKeyID -= 1
    }
    preKeyID += 1

    // If not found, use last-resort pre-key
    if (preKeyPublicKeyFingerprint === undefined) {
      preKeyID = lastPrekeyDate
      preKeyPublicKeyFingerprint = preKeyPublicKeyFingerprints[lastPrekeyDate]
    }
  }

  const publicKey = generatePublicKeyFromHexStr(preKeyPublicKeyFingerprint.slice(2))
  return {
    id: preKeyID,
    publicKey,
  }
}

export function generateMessageIDFromMAC(mac: Uint8Array) {
  return `0x${sodium.to_hex(mac)}`
}
