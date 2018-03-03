import { Cryptobox as WireCryptoBox } from 'wire-webapp-cryptobox'
import {
  message as proteusMessage,
  keys as proteusKeys,
} from 'wire-webapp-proteus'
import { IMessage as ITrustmeshRawMessage } from '@keymesh/trustmesh/lib/Messages'

import { ContractStore } from '../ContractStore'
import { getUserPublicKey } from '../UsersStore'
import { IUser, getCryptoBoxIndexedDBName } from '../UserStore'
import { IChatMessage } from '../ChatMessageStore'

import { MESSAGE_TYPE, createMessage, IMessageData } from '../../databases/MessagesDB'
import { createSession, ISession } from '../../databases/SessionsDB'

import { sleep } from '../../utils'
import {
  getBaseKeyFromMessage,
  getCipherMessageFromMessage,
  getPreKeyFromBundle,
  retoreProteusMessage,
  restoreProteusEnvelope,
  getPublicKeyFingerPrint,
} from '../../utils/proteus'
import { hexFromUint8Array, uint8ArrayFromHex } from '../../utils/hex'
import { solidityTimestampToJSTimestamp } from '../../utils/time'
import { uint8ArrayFromString, stringFromUint8Array } from '../../utils/sodium'

import PreKeyBundle from '../../PreKeyBundle'
import { Envelope, IEnvelopeHeader } from '../../Envelope'
import IndexedDBStore from '../../IndexedDBStore'

/**
 * Use to sign, verify, encrypt or decrypt message
 */
export default class CryptoBox {
  private readonly indexedDBStore: IndexedDBStore
  /**
   * don't access this directly, use `await this.getWireCryptoBox()`
   */
  private wireCryptoBox: WireCryptoBox | undefined

  constructor(
    private readonly user: IUser,
    private readonly contractStore: ContractStore,
  ) {
    const dbName = getCryptoBoxIndexedDBName(user)
    this.indexedDBStore = new IndexedDBStore(dbName)
    this.loadWireCryptoBox()
  }

  public async sign(message: string): Promise<string> {
    const identityKeyPair = await this.getIdentityKeyPair()
    return hexFromUint8Array(identityKeyPair.secret_key.sign(message))
  }

  public async verify(signature: string, message: string): Promise<boolean> {
    const signatureBytes = uint8ArrayFromHex(signature)
    const identityKeyPair = await this.getIdentityKeyPair()
    return identityKeyPair.public_key.public_key.verify(
      signatureBytes,
      message,
    )
  }

  public async getIdentityKeyPair(): Promise<proteusKeys.IdentityKeyPair> {
    const wireCryptoBox = await this.getWireCryptoBox()
    return wireCryptoBox.identity
  }

  public async encryptMessage(
    chatMessage: IChatMessage,
    preKeyBundle: PreKeyBundle,
  ): Promise<string> {
    const wireCryptoBox = await this.getWireCryptoBox()
    const { session } = chatMessage

    const rawMessage: IRawUnpaddedMessage = {
      senderAddress: this.user.userAddress,
      subject: session.data.subject,
      messageData: chatMessage.message.data,
    }
    const paddedRawMessage = padTo512Bytes(rawMessage)
    const { sessionTag } = session
    const isNewSession =
      chatMessage.message.data.messageType === MESSAGE_TYPE.HELLO
    const encryptedRawMessage = await wireCryptoBox.encrypt(
      sessionTag,
      paddedRawMessage.message,
      // pass preKeyBundle to create new session
      isNewSession ? preKeyBundle.serialise() : undefined,
    )
    const proteusEnvelope = proteusMessage.Envelope.deserialise(
      encryptedRawMessage,
    )
    const proteusEncyptedMessage = proteusEnvelope.message
    const baseKey = getBaseKeyFromMessage(proteusEncyptedMessage)

    const header: IEnvelopeHeader = {
      senderIdentity: wireCryptoBox.identity.public_key,
      sessionTag,
      mac: proteusEnvelope.mac,
      baseKey,
      isPreKeyMessage:
        proteusEncyptedMessage instanceof proteusMessage.PreKeyMessage,
      messageByteLength: paddedRawMessage.messageByteLength,
    }
    const cipherMessage = getCipherMessageFromMessage(proteusEncyptedMessage)

    const keymeshEnvelope = new Envelope(header, cipherMessage)
    const preKey = getPreKeyFromBundle(preKeyBundle)

    const cipherText = keymeshEnvelope.encrypt(preKey)

    return cipherText
  }

  public async decryptMessage(
    rawTrustmeshMessage: ITrustmeshRawMessage,
  ): Promise<IChatMessage> {
    const cipherText = rawTrustmeshMessage.message
    const { envelopeBuffer, preKeyID } = Envelope.getPreKeyIDAndEnvelopeBuffer(
      cipherText,
    )
    const preKey = await this.getPreKey(preKeyID)

    const keymeshEnvelope = Envelope.decrypt(envelopeBuffer, preKey)
    const keymeshEnvelopeHeader = keymeshEnvelope.header

    const proteusEncyptedMessage = retoreProteusMessage(
      keymeshEnvelope,
      preKeyID,
    )
    const proteusEnvelope = restoreProteusEnvelope(
      proteusEncyptedMessage,
      keymeshEnvelopeHeader.mac,
    )
    const wireCryptoBox = await this.getWireCryptoBox()
    const decryptedRawMessage = await wireCryptoBox.decrypt(
      keymeshEnvelope.header.sessionTag,
      proteusEnvelope.serialise(),
    )
    const paddedRawMessage: IRawPaddedMessage = {
      message: decryptedRawMessage,
      messageByteLength: keymeshEnvelopeHeader.messageByteLength,
    }
    const rawMessage = unpad512BytesMessage(paddedRawMessage)

    const { senderAddress, subject, messageData } = rawMessage
    // decrypt completed here

    if (messageData.messageType === MESSAGE_TYPE.HELLO) {
      // hack wire's cryptobox, reload data in order to re-use pre-key
      this.loadWireCryptoBox()
    }

    // validate message
    await this.validateMessageSender(
      senderAddress,
      keymeshEnvelopeHeader.senderIdentity,
    )
    this.validateMessageTimestamp(
      messageData.timestamp,
      solidityTimestampToJSTimestamp(rawTrustmeshMessage.timestamp),
    )

    // reconstruct ChatMessage
    const sessionData = {
      contact: senderAddress,
      subject,
    }
    const session = createSession(
      this.user,
      sessionData,
      keymeshEnvelopeHeader.sessionTag,
    )
    const message = createMessage(session, messageData)
    const chatMessage: IChatMessage = {
      session,
      message,
    }

    return chatMessage
  }

  public async loadWireCryptoBox() {
    this.wireCryptoBox = undefined
    const newWireCryptoBox = new WireCryptoBox(this.indexedDBStore as any, 0)
    await newWireCryptoBox.load()
    this.wireCryptoBox = newWireCryptoBox
  }

  private async getWireCryptoBox(): Promise<WireCryptoBox> {
    if (this.wireCryptoBox == null) {
      return await this.waitForCryptoBox()
    }

    return this.wireCryptoBox
  }

  private async waitForCryptoBox(interval = 300): Promise<WireCryptoBox> {
    while (this.wireCryptoBox == null) {
      await sleep(interval)
    }

    return this.wireCryptoBox
  }

  private async getPreKey(preKeyID: number): Promise<proteusKeys.PreKey> {
    const preKey = await this.indexedDBStore.load_prekey(preKeyID)
    if (preKey == null) {
      throw new Error('cannot load pre-key')
    }
    return preKey
  }

  private async validateMessageSender(
    senderAddress: string,
    senderIdentity: proteusKeys.IdentityKey,
  ) {
    const senderPublicKey = await getUserPublicKey(
      senderAddress,
      this.contractStore,
    )
    const claimedIdentityFingerPrint = getPublicKeyFingerPrint(senderPublicKey)
    const messageIdentityFingerPrint = getPublicKeyFingerPrint(senderIdentity)
    if (claimedIdentityFingerPrint !== messageIdentityFingerPrint) {
      throw new Error('Invalid message: sender not trusted')
    }
  }

  private validateMessageTimestamp(
    claimedTimestamp: number,
    blockTime: number,
  ) {
    const oneHour = 3600 * 1000
    if (
      blockTime > claimedTimestamp + oneHour ||
      blockTime < claimedTimestamp - oneHour
    ) {
      throw new Error('Invalid message: timstamp is not trusted')
    }
  }
}

export function padTo512Bytes(
  rawMessage: IRawUnpaddedMessage,
): IRawPaddedMessage {
  const typeArrayText = uint8ArrayFromString(JSON.stringify(rawMessage))
  const messageByteLength = typeArrayText.byteLength
  if (messageByteLength >= 512) {
    throw new RangeError('Message too large')
  }
  const message = new Uint8Array(512).fill(0xff)
  message.set(typeArrayText)

  return {
    message,
    messageByteLength,
  }
}

export function unpad512BytesMessage(
  rawMessage: IRawPaddedMessage,
): IRawUnpaddedMessage {
  const messageStr = stringFromUint8Array(
    rawMessage.message.subarray(0, rawMessage.messageByteLength),
  )
  return JSON.parse(messageStr)
}

export interface IRawUnpaddedMessage {
  messageData: IMessageData
  subject: ISession['data']['subject']
  senderAddress: string
}

export interface IRawPaddedMessage {
  message: Uint8Array
  messageByteLength: number
}
