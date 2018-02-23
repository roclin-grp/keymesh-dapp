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
} from './helpers'
import {
  ISendMessageOptions,
  SENDING_FAIL_CODE,
  ITrustbaseRawMessage,
  IRawUnppaddedMessage,
  IReceivedMessage,
  IDecryptedTrustbaseMessage,
} from './typings'

export class ChatMessagesStore {
  @observable public isFetching = false

  private userStore: UserStore
  private contractStore: ContractStore
  private metaMaskStore: MetaMaskStore

  private indexedDBStore: IndexedDBStore
  private cryptoBox: Cryptobox

  private cachedMessageStores: {
    [primaryKey: string]: ChatMessageStore,
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

  public sendMessage = async (
    toUserAddress: string,
    messageType: MESSAGE_TYPE,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      messageDidCreate = noop,
      sendingDidFail = noop,

      subject,
      plainText,
      sessionTag,
    }: ISendMessageOptions = {},
  ) => {
    if (toUserAddress === '') {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
    }

    // cache enviorment
    const {
      identitiesContract,
      messagesContract,
    } = this.contractStore
    const {
      cryptoBox,
    } = this
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

    if (toUserAddress === fromUserAddress) {
      return sendingDidFail(null, SENDING_FAIL_CODE.SEND_TO_YOURSELF)
    }

    let identityFingerprint = '0x0'
    let blockNumber = 0
    try {
      const {
        publicKey,
        blockNumber: _blockNumber,
      } = await identitiesContract.getIdentity(toUserAddress)
      identityFingerprint = publicKey
      blockNumber = _blockNumber
    } catch (err) {
      // if `toUserAddress` is not starts with '0x0', getIdentity will throw
      // but you can't use .catch here... wtf
    }

    if (isHexZeroValue(identityFingerprint)) {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
    }

    const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)
    if (isHexZeroValue(blockHash)) {
      throw new Error(`Can't not get blockhash`)
    }

    const {
      interval,
      lastPrekeyDate,
      preKeyPublicKeys: preKeyPublicKeyFingerprints,
    } = await getPreKeys(toUserAddress, identityFingerprint)
    if (Object.keys(preKeyPublicKeyFingerprints).length === 0) {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
    }

    let session: CryptoboxSession | null = null
    if (typeof sessionTag !== 'undefined') {
      // Is reply
      // Try to load local session and save to cache..
      session = await cryptoBox.session_load(sessionTag).catch((err) => {
        if (err.name !== 'RecordNotFoundError') {
          // Maybe we have a corrupted session on local, delete it.
          return Promise.all([
            cryptoBox.session_delete(sessionTag),
            sessionsDB.getSession(sessionTag, fromUserAddress).then((_session) => {
              if (_session) {
                return sessionsDB.deleteSession(_session)
              }
              return
            }),
          ]).then(() => null)
        }
        return null
      })
    }

    if (session === null) {
      messageType = MESSAGE_TYPE.HELLO
    }

    const {
      id: preKeyID,
      publicKey: preKeyPublicKey,
    } = getPreKey({
      interval,
      lastPrekeyDate,
      preKeyPublicKeyFingerprints,
    })

    const closeSession = messageType === MESSAGE_TYPE.CLOSE_SESSION

    let usingMessageType: MESSAGE_TYPE
    let usingSessionTag: string
    let envelope: Envelope
    let mac: Uint8Array
    let timestamp: number

    switch (messageType) {
      case MESSAGE_TYPE.HELLO:
        if (!closeSession && plainText === '') {
          return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_MESSAGE)
        }
        ({
          messageType: usingMessageType,
          sessionTag: usingSessionTag,
          envelope,
          mac,
          timestamp,
        } = await generateHelloMessage(
          {
            userAddress: fromUserAddress,
            cryptoBox,
          },
          {
            userAddress: toUserAddress,
            identityKey: generateIdentityKeyFromHexStr(identityFingerprint),
            preKeyPublicKey,
            preKeyID,
          },
          plainText,
          {
            closeSession,
            subject,
          },
        ))
        break
      case MESSAGE_TYPE.CLOSE_SESSION:
      case MESSAGE_TYPE.NORMAL:
        if (!closeSession && plainText === '') {
          return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_MESSAGE)
        }
        ({
          messageType: usingMessageType,
          sessionTag: usingSessionTag,
          envelope,
          mac,
          timestamp,
        } = await generateNormalMessage(
          {
            userAddress: fromUserAddress,
            cryptoBox,
          },
          plainText,
          sessionTag,
          {
            closeSession,
            subject,
          },
        ))
        break
      default:
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_MESSAGE_TYPE)
    }

    transactionWillCreate()
    const messageId = generateMessageIDFromMAC(mac)
    messagesContract.publish(envelope.encrypt(preKeyID, preKeyPublicKey))
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
        if (closeSession) {
          return
        }
        const createNewSession = async () => {
          const newSession = await sessionsStore.createSession({
            sessionTag: usingSessionTag,
            contact: {
              userAddress: toUserAddress,
              blockHash,
            },
            subject,
            // create message args
            messageId,
            messageType: usingMessageType,
            timestamp,
            plainText,
            isFromYourself: true,
            transactionHash: hash,
          })

          // refresh contacts
          this.userStore.refreshMemoryUser()

          sessionsStore.selectSession(newSession)
          return messagesDB.getMessage(messageId, fromUserAddress)
        }

        try {
          if (sessionTag !== usingSessionTag) {
            const newMessage = await createNewSession()
            if (typeof newMessage !== 'undefined') {
              messageDidCreate(newMessage)
            } else {
              sendingDidFail(new Error(`Can't create message`))
            }
          } else {
            const oldSession = await sessionsDB.getSession(sessionTag, fromUserAddress)
            if (!oldSession) {
              // cryptobox session corrupted
              await createNewSession()
            } else {
              const newMessage = await sessionsStore.getSessionStore(oldSession).createMessage({
                messageId,
                messageType,
                timestamp,
                plainText,
                isFromYourself: true,
                transactionHash: hash,
              })
              messageDidCreate(newMessage)
            }
          }
        } catch (err) {
          sendingDidFail(err)
        }
      })
      .on('error', async (error: Error) => {
        if (error.message.includes('Transaction was not mined within 50 blocks')) {
          // we don't care here
          // we handle timeout in UserStore.checkIdentityUploadStatus
          return
        }

        try {
          const message = await messagesDB.getMessage(messageId, fromUserAddress)
          if (typeof message !== 'undefined') {
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
    const primaryKey = `${message.userAddress}${message.messageId}`
    let store = this.cachedMessageStores[primaryKey]
    if (typeof store === 'undefined') {
      store = new ChatMessageStore(message, {
        metaMaskStore: this.metaMaskStore,
      })
      this.cachedMessageStores[primaryKey] = store
    }
    return store
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
