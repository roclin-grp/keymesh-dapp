
import {
  keys,
  message as proteusMessage,
} from 'wire-webapp-proteus'

import {
  MESSAGE_TYPE,
} from '../ChatMessageStore'

import {
  unixToday,
} from '../../utils/time'
import {
  hexFromUint8Array,
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
import { Cryptobox } from 'wire-webapp-cryptobox'

export interface ICryptoMessage {
  messageType: MESSAGE_TYPE,
  sessionTag: string
  envelope: Envelope,
  mac: Uint8Array,
  timestamp: number,
}

export interface IEncryptedCryptoMessage extends ICryptoMessage {
  messageId: string,
  cipherText: string,
}

export interface IMessageRequest {
  messageType: MESSAGE_TYPE,
  toAddress: string,

  plainText?: string,  // optional for "close session"

  subject?: string,
  sessionTag?: string, // if empty, create hello message
}

export interface IMessageSender {
  userAddress: string,
  cryptoBox: Cryptobox,
}

export interface IMessageReceiver {
  userAddress: string,
  identityKey: keys.IdentityKey,
  pubkeyHex: string,
  preKeyPublicKey: keys.PublicKey,
  preKeyID: number,
  blockHash: string,
}

export async function encryptMessage(
  sender: IMessageSender,
  receiver: IMessageReceiver,
  req: IMessageRequest,
): Promise<IEncryptedCryptoMessage> {
  const factory = new MessageFactory(sender, receiver, req)
  return factory.generateEncryptedMessage()
}

class MessageFactory {
  constructor(
    private readonly sender: IMessageSender,
    private readonly receiver: IMessageReceiver,
    private readonly req: IMessageRequest,
  ) {
  }

  public async generateEncryptedMessage(): Promise<IEncryptedCryptoMessage> {
    const msg = await this.generateMessage()

    const {
      mac,
      envelope,
    } = msg

    const messageId = generateMessageIDFromMAC(mac)

    const {
      preKeyID,
      preKeyPublicKey,
    } = this.receiver

    const cipherText = msg.envelope.encrypt(preKeyID, preKeyPublicKey)

    return {
      ...msg,
      cipherText,
      messageId,
    }
  }

  private async generateHelloMessage(
    plainText: string,
    subject?: string,
  ) {
    return generateHelloMessage(
      this.sender,
      this.receiver,
      plainText,
      {
        subject,
      },
    )
  }

  private async generateNormalMessage(
    sessionTag: string,
    plainText: string,
    subject?: string,
  ) {
    return generateNormalMessage(
      this.sender,
      plainText,
      sessionTag,
      {
        subject,
      },
    )
  }

  private async generateMessage(): Promise<ICryptoMessage> {
    const {
      toAddress,
      messageType,

      plainText,
      // optional
      subject,
      sessionTag,
    } = this.req

    switch (messageType) {
      case MESSAGE_TYPE.HELLO:
        if (plainText == null) {
          throw new Error('no message')
        }
        return this.generateHelloMessage(plainText, subject)
      case MESSAGE_TYPE.NORMAL:
        if (plainText == null) {
          throw new Error('no message')
        }

        if (sessionTag == null) {
          throw new Error('no session specified')
        }

        return this.generateNormalMessage(toAddress, plainText, subject)
      case MESSAGE_TYPE.CLOSE_SESSION:
      default:
        throw new Error('unknown message type')
    }
  }

}

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
  }: IGenerateMessageOptions = {},
): Promise<ICryptoMessage> {
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
    preKeyBundle.serialise(),
  )

  const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)
  if (proteusEnvelope.message instanceof proteusMessage.PreKeyMessage) {
    const preKeyMessage = proteusEnvelope.message
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
  throw new Error('Message type not match')
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
  }: IGenerateMessageOptions = {},
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
    paddedMessage,
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
  } else if (proteusEnvelope.message instanceof proteusMessage.CipherMessage) {
    cipherMessage = proteusEnvelope.message
    header = {
      senderIdentity,
      mac: proteusEnvelope.mac,
      baseKey: keys.KeyPair.new().public_key, // generate a new one
      isPreKeyMessage: false,
      sessionTag,
      messageByteLength,
    }
  } else {
    throw new Error('Unknown message type')
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

export function makeSessionTag() {
  return hexFromUint8Array(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))))
}

export async function getPreKeys(userAddress: string, identityFingerprint: string) {
  const uploadPreKeysUrl = process.env.REACT_APP_KVASS_ENDPOINT + userAddress
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

export function getPreKey({
  interval,
  lastPrekeyDate,
  preKeyPublicKeyFingerprints,
}: {
    interval: number,
    lastPrekeyDate: number,
    preKeyPublicKeyFingerprints: IPreKeyPublicKeyFingerprints,
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

  const publicKey = generatePublicKeyFromHexStr(preKeyPublicKeyFingerprint)
  return {
    id: preKeyID,
    publicKey,
  }
}

export function generateMessageIDFromMAC(mac: Uint8Array): string {
  return hexFromUint8Array(mac)
}
