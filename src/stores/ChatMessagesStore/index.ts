import {
  observable,
  runInAction,
} from 'mobx'
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
  IMessage,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
} from '../ChatMessageStore'

import {
  message as proteusMessage,
} from 'wire-webapp-proteus'
import {
  Cryptobox,
  CryptoboxSession,
} from 'wire-webapp-cryptobox'

import {
  getDatabases,
} from '../../databases'

import {
  noop,
} from '../../utils'
import {
  generateIdentityKeyFromHexStr,
  getEmptyProteusEnvelope,
  getPublicKeyFingerPrint,
} from '../../utils/proteus'
import {
  isHexZeroValue,
  uint8ArrayFromHex,
} from '../../utils/hex'
import {
  storeLogger,
} from '../../utils/loggers'

import IndexedDBStore from '../../IndexedDBStore'

import {
  Envelope,
} from '../../Envelope'

import {
  getPreKeys,
  getPreKey,
  generateHelloMessage,
  generateNormalMessage,
  generateMessageIDFromMAC,
  unpad512BytesMessage,
  ICryptoMessage,
  IMessageRequest,
  IMessageReceiver,
  IMessageSender,
  encryptMessage,
} from './helpers'
import {
  ISendMessageOptions,
  SENDING_FAIL_CODE,
  ITrustbaseRawMessage,
  IRawUnppaddedMessage,
  IReceivedMessage,
  IDecryptedTrustbaseMessage,
} from './typings'
import { SessionStore } from '../SessionStore'

// FIXME: Too similar to IMessage. Can we make them the same?
export interface IChatMessage {
  messageId: string
  messageType: MESSAGE_TYPE
  timestamp: number
  // FIXME: can just compare IUserIdentityKeys isFromYourself
  isFromYourself: boolean
  plainText?: string

  transactionHash?: string
  status?: MESSAGE_STATUS
}

export class ChatMessagesStore {
  @observable public isFetching = false

  private userStore: UserStore
  private contractStore: ContractStore
  private metaMaskStore: MetaMaskStore

  private indexedDBStore: IndexedDBStore
  private cryptoBox: Cryptobox

  private cachedMessageStores: {
    [messageId: string]: ChatMessageStore,
  } = {}
  private fetchTimeout!: number

  constructor({
    userStore,
    contractStore,
    metaMaskStore,
    indexedDBStore,
    cryptoBox,
  }: {
      userStore: UserStore
      contractStore: ContractStore
      metaMaskStore: MetaMaskStore
      indexedDBStore: IndexedDBStore
      cryptoBox: Cryptobox,
    }) {
    this.userStore = userStore
    this.contractStore = contractStore
    this.metaMaskStore = metaMaskStore
    this.indexedDBStore = indexedDBStore
    this.cryptoBox = cryptoBox
  }

  public get getMessageSender(): IMessageSender {

    return {
      userAddress: this.userStore.user.userAddress,
      cryptoBox: this.cryptoBox,
    }
  }

  // select a prekey
  public async getPrekey(address: string, pubkeyHex: string) {
    const {
      interval,
      lastPrekeyDate,
      preKeyPublicKeys,
    } = await getPreKeys(address, pubkeyHex)

    if (Object.keys(preKeyPublicKeys).length === 0) {
      throw new Error('no prekeys uploaded yet')
    }

    const {
      id: preKeyID,
      publicKey: preKeyPublicKey,
    } = getPreKey({
      interval,
      lastPrekeyDate,
      preKeyPublicKeyFingerprints: preKeyPublicKeys,
    })

    return {
      preKeyID,
      preKeyPublicKey,
    }
  }

  public async getMessageReceiver(address: string): Promise<IMessageReceiver> {
    const {
      publicKey: pubkeyHex,
      blockNumber,
    } = await this.contractStore.identitiesContract.getIdentity(address)

    if (isHexZeroValue(pubkeyHex)) {
      throw new Error('cannot find identity')
    }

    const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)
    if (isHexZeroValue(blockHash)) {
      throw new Error('cannot find identity block hash')
    }

    const {
      preKeyPublicKey,
      preKeyID,
    } = await this.getPrekey(address, pubkeyHex)

    return {
      userAddress: address,
      pubkeyHex,
      identityKey: generateIdentityKeyFromHexStr(pubkeyHex),
      blockHash,
      preKeyPublicKey,
      preKeyID,
    }
  }

  public async getCryptoboxSession(sessionTag: string): Promise<CryptoboxSession> {
    return this.cryptoBox.session_load(sessionTag)
  }

  public async getSessionStore(sessionTag: string): Promise<SessionStore> {
    const {
      sessionsDB,
    } = getDatabases()

    // why not just search for session store with a unique session string id?
    const sessionInfo = await sessionsDB.getSession(sessionTag, this.getMessageSender.userAddress)

    if (!sessionInfo) {
      throw new Error(`Cannot find session: ${sessionTag}`)
    }

    return this.userStore.sessionsStore.getSessionStore(sessionInfo)
  }

  public async addMessageToSession(blockHash: string, sessionTag: string, req: IMessageRequest, chatmsg: IChatMessage) {
    const { sessionsStore } = this.userStore
    const isNewSession = req.sessionTag == null

    if (isNewSession) {
      // will create a sesssion and add the message to it in a transaction
      const sessionInfo = {
        sessionTag,
        contact: {
          userAddress: req.toAddress,
          // blockhash is used to generate identicon
          blockHash,
        },
        subject: req.subject,
      }

      const newSession = await sessionsStore.createSession(sessionInfo, chatmsg)

      // switch to new session
      sessionsStore.selectSession(newSession)

      // FIXME: can remove this later
      this.userStore.refreshMemoryUser()

      return
    }

    // Add the message
    const sessionStore = await this.getSessionStore(sessionTag)
    await sessionStore.createMessage(chatmsg)

    return
  }

  public sendMessage = async (
    req: IMessageRequest,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      messageDidCreate = noop,
      sendingDidFail = noop,
    }: ISendMessageOptions = {},
  ) => {

    const {
      messagesContract,
    } = this.contractStore
    const {
      user: {
        userAddress: fromUserAddress,
      },
      sessionsStore,
    } = this.userStore
    const {
      sessionsDB,
      messagesDB,
    } = getDatabases()

    if (req.toAddress === fromUserAddress) {
      return sendingDidFail(null, SENDING_FAIL_CODE.SEND_TO_YOURSELF)
    }

    const sender = this.getMessageSender
    const receiver = await this.getMessageReceiver(req.toAddress)
    const msg = await encryptMessage(sender, receiver, req)

    const isClosingSession = req.messageType === MESSAGE_TYPE.CLOSE_SESSION

    transactionWillCreate()

    const tx = await messagesContract.publish(msg.cipherText)

    messagesContract.publish(msg.cipherText)
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
        if (isClosingSession) {
          return
        }

        const chatmsg: IChatMessage = {
          messageId: msg.messageId,
          messageType: req.messageType,
          timestamp: msg.timestamp,
          plainText: req.plainText,
          isFromYourself: true,
          transactionHash: hash,
        }

        try {
          await this.addMessageToSession(
            receiver.blockHash,
            msg.sessionTag,
            req,
            chatmsg,
          )
        } catch (err) {
          sendingDidFail(err)
        }
      })
      .on('error', async (error: Error) => {
        if (error.message.includes('Transaction was not mined within 50 blocks')) {
          // we don't know whether the tx was confirmed or not. don't do anything.
          return
        }

        try {
          // mark the message as sending failed
          const message = await messagesDB.getMessage(msg.messageId, fromUserAddress)
          if (message != null) {
            this.getMessageStore(message).updateMessageStatus(MESSAGE_STATUS.FAILED)
          }
        } finally {
          sendingDidFail(error)
        }
      })
  }

  public startFetchChatMessages = async () => {
    if (this.isFetching) {
      return
    }
    let isOutdatedPrekeysDeleted = false

    const fetNewChatMessagesLoop = async () => {
      try {
        await this.fetchNewChatMessages()
        if (!isOutdatedPrekeysDeleted) {
          this.userStore.deleteOutdatedPreKeys()
          isOutdatedPrekeysDeleted = true
        }
      } finally {
        clearTimeout(this.fetchTimeout)
        this.fetchTimeout = window.setTimeout(
          fetNewChatMessagesLoop,
          FETCH_BROADCAST_MESSAGES_INTERVAL,
        )
      }
    }

    clearTimeout(this.fetchTimeout)
    this.fetchTimeout = window.setTimeout(fetNewChatMessagesLoop, 0)
    runInAction(() => {
      this.isFetching = true
    })
  }

  public stopFetchChatMessages = () => {
    if (this.isFetching) {
      window.clearTimeout(this.fetchTimeout)
      runInAction(() => {
        this.isFetching = false
      })
    }
  }

  public getMessageStore = (message: IMessage): ChatMessageStore => {
    const oldStore = this.cachedMessageStores[message.messageId]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new ChatMessageStore(message, {
      metaMaskStore: this.metaMaskStore,
    })
    this.cachedMessageStores[message.messageId] = newStore
    return newStore
  }

  public clearCachedStores() {
    this.cachedMessageStores = {}
  }

  private fetchNewChatMessages = async () => {
    const lastFetchBlock = this.userStore.user.lastFetchBlockOfChatMessages
    const {
      sessionsDB,
    } = getDatabases()
    const {
      lastBlock,
      result: messages,
    } = await this.contractStore.messagesContract.getMessages({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0,
    })

    const {
      user,
      sessionsStore,
    } = this.userStore

    const newLastBlock = lastBlock < 3 ? 0 : lastBlock - 3
    if (messages.length === 0) {
      return this.updateUserLastFetchBlockOfChatMessages(newLastBlock)
    }

    const newReceivedMessages = (await Promise.all(messages
      .map((message) => this.decryptMessage(message).catch(() => null))))
      .filter((message) => message !== null) as IReceivedMessage[]

    await Promise.all(newReceivedMessages.map(async (message) => {
      try {
        const messageId = generateMessageIDFromMAC(message.mac)
        const sessionTag = message.sessionTag

        const oldSession = await sessionsDB.getSession(sessionTag, user.userAddress)
        if (!oldSession) {
          await sessionsStore.createSession(Object.assign({}, message, {
            messageId,
            contact: {
              blockHash: message.blockHash!,
              userAddress: message.fromUserAddress!,
            },
          }))

          // refresh contacts
          this.userStore.refreshMemoryUser()
        } else {
          await sessionsStore.getSessionStore(oldSession).createMessage(Object.assign({}, message, { messageId }))
        }
      } catch (err) {
        storeLogger.error(err)
      }
    }))

    await this.updateUserLastFetchBlockOfChatMessages(newLastBlock)
  }

  private updateUserLastFetchBlockOfChatMessages = async (newLastBlock: number) => {
    const {
      user,
    } = this.userStore
    const {
      usersDB,
    } = getDatabases()
    await usersDB.updateUser(user, {
      lastFetchBlockOfChatMessages: newLastBlock,
    })
    runInAction(() => {
      user.lastFetchBlockOfChatMessages = newLastBlock
    })
  }

  private decryptMessage = async ({
    message: encryptedConcatedBufferStr,
    timestamp,
  }: ITrustbaseRawMessage) => {
    const {
      user,
    } = this.userStore
    const {
      sessionsDB,
    } = getDatabases()
    const concatedBuf = uint8ArrayFromHex(encryptedConcatedBufferStr)
    const preKeyID = new Uint16Array(concatedBuf.slice(0, PRE_KEY_ID_BYTES_LENGTH).buffer)[0]
    const preKey = await this.indexedDBStore.load_prekey(preKeyID)

    const keymeshEnvelope = Envelope.decrypt(
      concatedBuf.slice(PRE_KEY_ID_BYTES_LENGTH),
      preKey,
    )

    const proteusEnvelope = getEmptyProteusEnvelope()
    const {
      senderIdentity,
      mac,
      baseKey,
      sessionTag,
      isPreKeyMessage,
      messageByteLength,
    } = keymeshEnvelope.header

    proteusEnvelope.mac = mac
    proteusEnvelope._message_enc = (() => {
      if (isPreKeyMessage) {
        return new Uint8Array((proteusMessage.PreKeyMessage.new(
          preKeyID,
          baseKey,
          senderIdentity,
          keymeshEnvelope.cipherMessage,
        ) as any).serialise())
      }
      return new Uint8Array((keymeshEnvelope.cipherMessage as any).serialise())
    })()

    await this.cryptoBox.session_load(sessionTag).catch((err) => {
      if (err.name !== 'RecordNotFoundError') {
        // Maybe we have a corrupted session on local, delete it.
        return Promise.all([
          this.cryptoBox.session_delete(sessionTag),
          sessionsDB.getSession(sessionTag, user.userAddress).then((session) => {
            if (session) {
              return sessionsDB.deleteSession(session)
            }
            return
          }),
        ]) as any
      }
      return
    })

    return this.cryptoBox.decrypt(sessionTag, proteusEnvelope.serialise())
      .then((decryptedPaddedMessage) => this.deserializeMessage({
        decryptedPaddedMessage,
        senderIdentity,
        timestamp,
        messageByteLength,
      }))
      .then((message) => Object.assign(message, {
        mac,
        sessionTag,
      }))
  }

  private deserializeMessage = async ({
    decryptedPaddedMessage,
    senderIdentity,
    timestamp: blockTimestampSecStr,
    messageByteLength,
  }: IDecryptedTrustbaseMessage) => {
    const unpaddedMessage = unpad512BytesMessage(decryptedPaddedMessage, messageByteLength)
    const {
      subject,
      messageType,
      fromUserAddress,
      plainText,
      timestamp,
    } = JSON.parse(unpaddedMessage) as IRawUnppaddedMessage

    let blockHash
    if (fromUserAddress) {
      const {
        blockNumber,
        publicKey: expectedFingerprint,
      } = await this.contractStore.identitiesContract.getIdentity(fromUserAddress)

      if (messageType === MESSAGE_TYPE.HELLO) {
        // we need to reload cryptobox in order to reuse the pre-key used for
        // create new session, otherwise user will not able to create new session
        this.cryptoBox = await this.userStore.reloadCryptobox()
      }

      blockHash = await this.metaMaskStore.getBlockHash(blockNumber)

      if (expectedFingerprint !== getPublicKeyFingerPrint(senderIdentity)) {
        const err = new Error('Invalid message: sender identity not match')
        throw err
      }
    }

    const blockTimestamp = Number(blockTimestampSecStr) * 1000
    if (blockTimestamp > timestamp + 3600 * 1000 || blockTimestamp < timestamp - 3600 * 1000) {
      const err = new Error('Invalid message: timstamp is not trusted')
      throw err
    }

    return {
      messageType,
      subject,
      timestamp,
      fromUserAddress,
      blockHash,
      plainText,
    }
  }
}

const PRE_KEY_ID_BYTES_LENGTH = 2
const FETCH_BROADCAST_MESSAGES_INTERVAL = 10 * 1000
