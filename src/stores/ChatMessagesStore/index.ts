import { Cryptobox } from 'wire-webapp-cryptobox'
import { IMessage as ITrustmeshRawMessage } from '@keymesh/trustmesh/lib/Messages'

import {
  MetaMaskStore,
} from '../MetaMaskStore'
import {
  ContractStore,
} from '../ContractStore'
import {
  UserStore,
} from '../UserStore'
import {
  ChatMessageStore,
} from '../ChatMessageStore'

import {
  getDatabases,
} from '../../databases'

import { sleep } from '../../utils'
import {
  generateIdentityKeyFromHexStr,
  getEmptyProteusEnvelope,
  getPublicKeyFingerPrint,
} from '../../utils/proteus'
import {
  isHexZeroValue,
  uint8ArrayFromHex,
} from '../../utils/hex'

import IndexedDBStore from '../../IndexedDBStore'

import {
  Envelope,
} from '../../Envelope'

import {
  unpad512BytesMessage,
  generateEncryptedMessageEnvelope,
  getReceiverAvailablePrekey,
  retoreEncryptedProteusMessagefromKeymeshEnvelope,
} from './helpers'
import {
  IRawUnpaddedMessage,
  IReceivedMessage,
  IMessageSender,
  IMessageReceiver,
} from './typings'
import { ISession, createSession } from '../../databases/SessionsDB'
import { IMessage, createMessage, IAddMessageOptions, MESSAGE_TYPE, MESSAGE_STATUS } from '../../databases/MessagesDB'
import PreKeyBundle from '../../PreKeyBundle'
import { storeLogger } from '../../utils/loggers'
import { solidityTimestampToJSTimestamp } from '../../utils/time'

export class ChatMessagesStore {
  private isFetching = false
  private cachedMessageStores: { [messageID: string]: ChatMessageStore } = {}

  // define as computed value because `this.cryptoBox` will change
  private get messageSender(): IMessageSender {
    return {
      userAddress: this.userStore.user.userAddress,
      cryptoBox: this.cryptoBox,
    }
  }

  constructor(
    private readonly userStore: UserStore,
    private readonly contractStore: ContractStore,
    private readonly metaMaskStore: MetaMaskStore,
    private readonly indexedDBStore: IndexedDBStore,
    private cryptoBox: Cryptobox,
  ) {
  }

  public async sendMessage(receiver: IMessageReceiver, session: ISession, message: IMessage) {
    const encryptedMessage = await this.generateEncryptedMessage(receiver, session, message)

    const { transactionHash } = await this.contractStore.messagesContract.publish(encryptedMessage)

    const isClosingSession = message.data.messageType === MESSAGE_TYPE.CLOSE_SESSION
    if (isClosingSession) {
      // no need to save delete session message, return
      return
    }

    message.meta = {
      ...message.meta,
      transactionHash,
      isFromYourself: true,
      status: MESSAGE_STATUS.DELIVERING,
    }
    await this.saveNewMessage(session, message)
  }

  public async getMessageReceiver(userAddress: string): Promise<IMessageReceiver> {
    const identityKeyFingerPrint = await this.getContact(userAddress)
    const preKey = await getReceiverAvailablePrekey(userAddress, identityKeyFingerPrint)

    return {
      userAddress,
      identityKeyFingerPrint,
      preKey,
    }
  }

  public async startFetchChatMessages(interval = FETCH_BROADCAST_MESSAGES_INTERVAL) {
    if (this.isFetching) {
      return
    }

    this.isFetching = true

    let isOutdatedPrekeysDeleted = false
    while (this.isFetching) {
      try {
        await this.fetchNewChatMessages()

        if (!isOutdatedPrekeysDeleted) {
          this.userStore.deleteOutdatedPreKeys()
          isOutdatedPrekeysDeleted = true
        }
      } finally {
        await sleep(interval)
      }
    }
  }

  public stopFetchChatMessages() {
    this.isFetching = false
  }

  public getMessageStore(message: IMessage): ChatMessageStore {
    const { messageID } = message

    const oldStore = this.cachedMessageStores[messageID]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new ChatMessageStore(message, this.metaMaskStore)
    this.cachedMessageStores[messageID] = newStore
    return newStore
  }

  public clearCachedStores() {
    this.cachedMessageStores = {}
  }

  private async getContact(userAddress: string): Promise<string> {
    const { publicKey } = await this.contractStore.identitiesContract.getIdentity(userAddress)

    if (isHexZeroValue(publicKey)) {
      throw new Error('cannot find identity')
    }

    return publicKey
  }

  private async generateEncryptedMessage(
    receiver: IMessageReceiver,
    session: ISession,
    message: IMessage,
  ): Promise<string> {
    const { preKey } = receiver
    const preKeyBundle = PreKeyBundle.create(
      generateIdentityKeyFromHexStr(receiver.identityKeyFingerPrint),
      preKey,
    )

    const envelope = await generateEncryptedMessageEnvelope(
      this.messageSender,
      session,
      message,
      preKeyBundle,
    )

    return envelope.encrypt(preKey)
  }

  private async fetchNewChatMessages() {
    const lastFetchBlock = this.userStore.user.lastFetchBlockOfChatMessages
    const {
      lastBlock,
      result: trustmeshRawMessages,
    } = await this.contractStore.messagesContract.getMessages({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0,
    })

    const newLastFetchBlock = lastBlock < 3 ? 0 : lastBlock - 3
    if (trustmeshRawMessages.length === 0) {
      this.updateUserLastFetchBlockOfChatMessages(newLastFetchBlock)
      return
    }

    const decryptedMessages = await this.decryptMessages(trustmeshRawMessages)
    this.saveReceivedMessages(decryptedMessages)

    await this.updateUserLastFetchBlockOfChatMessages(newLastFetchBlock)
  }

  private async updateUserLastFetchBlockOfChatMessages(lastFetchBlockOfChatMessages: number) {
    return this.userStore.updateUser({
      lastFetchBlockOfChatMessages,
    })
  }

  private async decryptMessages(messages: ITrustmeshRawMessage[]): Promise<Array<IReceivedMessage | null>> {
    const decryptMessagesPromises: Array<Promise<IReceivedMessage | null>> = []
    for (const trustmeshRawMessage of messages) {
      const decryptMessagePromise = this.decryptMessage(trustmeshRawMessage).catch((err) => {
        // TODO: handle unexpected decrypt error, avoid message lost
        storeLogger.error('decrypt message error:', err)
        return null
      })
      decryptMessagesPromises.push(decryptMessagePromise)
    }
    return Promise.all(decryptMessagesPromises)
  }

  private async decryptMessage(rawMessage: ITrustmeshRawMessage): Promise<IReceivedMessage> {
    const prependedPreKeyIdEnvelopeBuf = uint8ArrayFromHex(rawMessage.message)
    const envelopeBuf = prependedPreKeyIdEnvelopeBuf.slice(PRE_KEY_ID_BYTES_LENGTH)
    const preKeyID = new Uint16Array(prependedPreKeyIdEnvelopeBuf.slice(0, PRE_KEY_ID_BYTES_LENGTH).buffer)[0]
    const preKey = await this.indexedDBStore.load_prekey(preKeyID)
    if (preKey == null) {
      throw new Error('cannot load prekey')
    }

    const keymeshEnvelope = Envelope.decrypt(envelopeBuf, preKey)
    const proteusEncryptedMessage = retoreEncryptedProteusMessagefromKeymeshEnvelope(keymeshEnvelope, preKeyID)
    const proteusEnvelope = getEmptyProteusEnvelope()
    proteusEnvelope.mac = keymeshEnvelope.header.mac
    proteusEnvelope._message_enc = new Uint8Array(proteusEncryptedMessage.serialise())

    const decryptedRawMessage = await this.cryptoBox.decrypt(
      keymeshEnvelope.header.sessionTag, proteusEnvelope.serialise(),
    )

    const deserializedMessage = this.deserializeMessage(
      decryptedRawMessage,
      keymeshEnvelope,
      solidityTimestampToJSTimestamp(rawMessage.timestamp),
    )

    return deserializedMessage
  }

  private async deserializeMessage(
    rawMessage: Uint8Array,
    envelope: Envelope,
    messagesBlockTimestamp: number,
  ): Promise<IReceivedMessage> {
    const unpaddedMessageStr = unpad512BytesMessage(rawMessage, envelope.header.messageByteLength)
    const unpaddedMessage = JSON.parse(unpaddedMessageStr) as IRawUnpaddedMessage
    const {
      senderAddress,
      messageData,
    } = unpaddedMessage

    const { senderIdentity } = envelope.header
    const claimedIdentityFingerPrint = await this.getContact(senderAddress)
    const messageIdentityFingerPrint = getPublicKeyFingerPrint(senderIdentity)
    if (claimedIdentityFingerPrint !== messageIdentityFingerPrint) {
      throw new Error('Invalid message: sender not trusted')
    }

    // claimedTimestamp is timestamp that message sender claim
    const claimedTimestamp = messageData.timestamp
    const oneHour = 3600 * 1000
    if (
      messagesBlockTimestamp > claimedTimestamp + oneHour
      || messagesBlockTimestamp < claimedTimestamp - oneHour
    ) {
      const err = new Error('Invalid message: timstamp is not trusted')
      throw err
    }

    if (messageData.messageType === MESSAGE_TYPE.HELLO) {
      // hack cryptobox
      // reload cryptobox in order to reuse the pre-key used for create new session
      this.cryptoBox = await this.userStore.reloadCryptobox()
    }

    const sessionData = {
      contact: senderAddress,
      subject: unpaddedMessage.subject,
    }
    const { sessionTag } = envelope.header
    const session = createSession(this.userStore.user, sessionData, sessionTag)

    const message = createMessage(session, messageData)

    return {
      session,
      message,
    }
  }

  private async saveReceivedMessages(messages: Array<IReceivedMessage | null>) {
    const processMessagePromises: Array<Promise<void>> = []
    for (const decryptedMessage of messages) {
      if (decryptedMessage == null) {
        continue
      }

      const processMessagePromise = this.saveNewMessage(decryptedMessage.session, decryptedMessage.message)
        .catch((err) => {
          storeLogger.error('saving message error:', err)
        })
      processMessagePromises.push(processMessagePromise)
    }

    await Promise.all(processMessagePromises)
  }

  private async saveNewMessage(session: ISession, message: IMessage, saveMessageOptions?: IAddMessageOptions) {
    const oldSession = await getDatabases().sessionsDB.getSession(
      session.sessionTag,
      session.userAddress,
    )

    if (oldSession == null) {
      await this.userStore.sessionsStore.saveSession(session, message, saveMessageOptions)
      return
    }

    await this.userStore.sessionsStore.getSessionStore(oldSession).saveMessage(message, saveMessageOptions)
  }
}

const PRE_KEY_ID_BYTES_LENGTH = 2
const FETCH_BROADCAST_MESSAGES_INTERVAL = 10 * 1000
