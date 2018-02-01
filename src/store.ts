import {
  observable,
  runInAction,
  useStrict,
} from 'mobx'

import {
  getWeb3,
  Identities,
  Messages,
  BroadcastMessages,
} from 'trustbase'

import {
  BlockType
} from 'trustbase/typings/web3.d'

import {
  keys,
  message as proteusMessage,
} from 'wire-webapp-proteus'
import {
  Cryptobox,
  CryptoboxSession,
} from 'wire-webapp-cryptobox'

const sodium = require('libsodium-wrappers-sumo')

import DB from './DB'
import IndexedDBStore from './IndexedDBStore'
import {
  PreKeysPackage,
  IpreKeyPublicKeys,
} from './PreKeysPackage'
import PreKeyBundle from './PreKeyBundle'
import {
  Envelope,
  IenvelopeHeader,
} from './Envelope'

import {
  IsignedBroadcastMessage,
  IreceviedBroadcastMessage,
} from '../typings/interface.d'

import {
  Isession,
  IsendingLifecycle,
  ItrustbaseRawMessage,
  IdecryptedTrustbaseMessage,
  IrawUnppaddedMessage,
  IreceivedMessage,
  Imessage,
  IcheckMessageStatusLifecycle,
  SENDING_FAIL_CODE,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
} from './stores/SessionStore'

import {
  Iuser,
  Icontact,
} from './stores/UserStore'

import {
  FETCH_MESSAGES_INTERVAL,
  FETCH_BROADCAST_MESSAGES_INTERVAL,
  PRE_KEY_ID_BYTES_LENGTH,
} from './constants'

import {
  noop,
} from './utils'

import {
  utf8ToHex,
  hexToUtf8,
} from './utils/hex'

import {
  storeLogger,
} from './utils/loggers'

import {
  unixToday,
} from './utils/time'

import {
  ETHEREUM_NETWORKS,
  ETHEREUM_CONNECT_ERROR_CODE,
} from './stores/EthereumStore'

enum ETHEREUM_CONNECT_STATUS {
  PENDING = 0,
  ACTIVE,
  ERROR
}

import {
  generatePublicKeyFromHexStr,
} from './utils/proteus'

const {
  PENDING,
  ACTIVE,
} = ETHEREUM_CONNECT_STATUS

useStrict(true)

// type TypeConnectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => void

export class Store {
  @observable public connectStatus: ETHEREUM_CONNECT_STATUS = PENDING
  @observable public connectErrorCode: ETHEREUM_CONNECT_ERROR_CODE | undefined
  @observable public connectError: Error | undefined
  @observable public currentEthereumNetwork: ETHEREUM_NETWORKS | undefined
  @observable public currentEthereumAccount = ''
  @observable.ref public currentNetworkUsers: Iuser[] = []
  @observable.ref public currentUser: Iuser | undefined
  @observable.ref public currentUserContacts: Icontact[] = []
  @observable.ref public currentUserSessions: Isession[] = []
  @observable public newMessageCount = 0
  @observable.ref public currentSession: Isession | undefined
  @observable.ref public currentSessionMessages: Imessage[] = []
  @observable.ref public broadcastMessages: IreceviedBroadcastMessage[] = []
  @observable public isFetchingMessage = false
  @observable public isFetchingBroadcast = false

  private currentUserlastFetchBlock: BlockType = 0
  private currentUserlastFetchBlockOfBroadcast: BlockType = 0
  private indexedDBStore: IndexedDBStore | undefined
  private box: Cryptobox | undefined
  private identitiesContract: Identities
  private messagesContract: Messages
  private broadcastMessagesContract: BroadcastMessages
  private fetchMessagesTimeout: number
  private fetchBroadcastMessagesTimeout: number
  private db: DB = new DB()
  private broadcastMessagesSignatures: string[] = []

  public getUserPublicKey = async (
    userAddress: string
  ) => {
    const {
      publicKey: identityFingerprint
    } = await this.getIdentity(userAddress)
    if (Number(identityFingerprint) === 0) {
      return ''
    }
    return identityFingerprint
  }

  public getIdentity = async (userAddress: string) => {
    return await this.identitiesContract.getIdentity(userAddress)
  }

  public getCurrentUserPublicKey = async () => {
    if (typeof this.currentUser === 'undefined') {
      return ''
    }

    return await this.getUserPublicKey(this.currentUser.userAddress)
  }

  public checkMessageStatus = async (
    message: Imessage,
    {
      sendingDidFail = noop,
    }: IcheckMessageStatusLifecycle = {}
  ) => {
    if (message.transactionHash === undefined) {
      return
    }
    const txHash: string = message.transactionHash

    const web3 = getWeb3()
    const waitForTransactionReceipt = async (counter = 0) => {
      if (this.connectStatus !== ACTIVE) {
        return
      }
      const receipt = await web3.eth.getTransactionReceipt(txHash)
      if (receipt !== null) {
        if (counter >= Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          this.db.updateMessageStatus(message, MESSAGE_STATUS.DELIVERED)
            .then(async () => {
              if (this.currentSession !== undefined && message.sessionTag === this.currentSession.sessionTag) {
                const _messages = await this.db.getMessages(message.sessionTag, message.userAddress)
                if (_messages.length !== 0) {
                  runInAction(() => {
                    this.currentSessionMessages = _messages
                  })
                }
              }
            })
            .catch(() => {
              storeLogger.error('update message status to DELIVERED error')
            })
          return
        } else {
          window.setTimeout(waitForTransactionReceipt, 1000, counter + 1)
          return
        }
      }

      if (counter === 50) {
        return sendingDidFail()
      }

      window.setTimeout(waitForTransactionReceipt, 1000, counter)
    }

    return waitForTransactionReceipt()
  }

  public getBlockHash = async (blockNumber: number): Promise<string|'0x0'> => {
    return await getWeb3().eth.getBlock(blockNumber)
      .then((block) => block.hash)
      .catch((err: Error) => {
        storeLogger.error(err)
        return '0x0'
      })
  }

  public send = async (
    toUserAddress: string,
    subject: string,
    plainText: string,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      sendingDidComplete = noop,
      sendingDidFail = noop
    }: IsendingLifecycle = {},
    sessionTag = '',
    closeSession = false
  ) => {
    switch (true) {
      case this.connectStatus !== ACTIVE:
        return sendingDidFail(null, SENDING_FAIL_CODE.NOT_CONNECTED)
      case toUserAddress === '':
        return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
      case plainText === '':
      default:
    }

    if (!this.box) {
      // just for type checker, should never enter this block
      return sendingDidFail(new Error('Could not found cryptobox instance'))
    }

    const currentUser = this.currentUser

    if (!currentUser) {
      return sendingDidFail(new Error('Could not found user'))
    }

    if (toUserAddress === currentUser.userAddress) {
      return sendingDidFail(null, SENDING_FAIL_CODE.SEND_TO_YOURSELF)
    }

    const web3 = getWeb3()

    const {
      publicKey: identityFingerprint,
      blockNumber
    } = await this.identitiesContract.getIdentity(toUserAddress)

    const blockHash = await web3.eth.getBlock(blockNumber).then((block) => block.hash).catch(() => '0x0')
    if (!identityFingerprint || blockHash === '0x0') {
      return
    }
    if (Number(identityFingerprint) === 0) {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
    }

    let session: CryptoboxSession | null = null
    if (sessionTag !== '') {
      // Is reply
      // Try to load local session and save to cache..
      session = await this.box.session_load(sessionTag).catch((err) => {
        if (err.name !== 'RecordNotFoundError') {
          // Maybe we have a corrupted session on local, delete it.
          return Promise.all([
            (this.box as Cryptobox).session_delete(sessionTag),
            this.db.getSession(sessionTag, currentUser.userAddress).then((_session) => {
              if (_session) {
                return this.db.deleteSession(this.currentUser as Iuser, _session)
              }
              return
            })
          ]).then(() => null)
        }
        return null
      })
    }

    const nowTimestamp = Date.now()

    const {
      interval,
      lastPrekeyDate,
      preKeyPublicKeys
    } = await this.getPreKeys(toUserAddress)
    if (Object.keys(preKeyPublicKeys).length === 0) {
      sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USER_ADDRESS)
      return
    }

    const {
      id: preKeyID,
      publicKey: preKeyPublicKey
    } = getPreKey({
      interval,
      lastPrekeyDate,
      preKeyPublicKeys
    })

    const fromUserAddress = currentUser.userAddress
    const senderIdentity = (this.box as Cryptobox).identity.public_key
    const isFromYourself = true
    const {
      messageType,
      usingSessionTag,
      keymailEnvelope,
      mac
    } = await (async () => {
      // New conversation
      if (session === null) {
        const _messageType = MESSAGE_TYPE.HELLO
        const {
          result: paddedMessage,
          messageByteLength
        } = padTo512Bytes(JSON.stringify({
          timestamp: nowTimestamp,
          subject,
          messageType: _messageType,
          fromUserAddress,
          plainText
        } as IrawUnppaddedMessage))

        const identityKey = identityKeyFromHexStr(identityFingerprint.slice(2))
        const preKeyBundle = PreKeyBundle.create(identityKey, preKeyPublicKey, preKeyID)

        const _usingSessionTag = sessionTag === '' ? makeSessionTag() : sessionTag
        const encryptedMessage = await (this.box as Cryptobox).encrypt(
          _usingSessionTag,
          paddedMessage,
          preKeyBundle.serialise()
        )

        const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)
        const preKeyMessage: proteusMessage.PreKeyMessage = proteusEnvelope.message as any
        const cipherMessage = preKeyMessage.message
        const header = {
          senderIdentity,
          mac: proteusEnvelope.mac,
          baseKey: preKeyMessage.base_key,
          sessionTag: _usingSessionTag,
          isPreKeyMessage: true,
          messageByteLength
        }

        return {
          messageType: _messageType,
          usingSessionTag: _usingSessionTag,
          keymailEnvelope: new Envelope(header, cipherMessage),
          mac: proteusEnvelope.mac
        }
      } else {
        const _messageType = closeSession ? MESSAGE_TYPE.CLOSE_SESSION : MESSAGE_TYPE.NORMAL
        const {
          result: paddedMessage,
          messageByteLength
        } = padTo512Bytes(JSON.stringify({
          timestamp: nowTimestamp,
          subject,
          messageType: _messageType,
          plainText
        } as IrawUnppaddedMessage))

        const encryptedMessage = await (this.box as Cryptobox).encrypt(
          sessionTag,
          paddedMessage
        )

        const envelope = proteusMessage.Envelope.deserialise(encryptedMessage)
        const _keymailEnvelope = (() => {
          let cipherMessage: proteusMessage.CipherMessage
          let header: IenvelopeHeader
          if (envelope.message instanceof proteusMessage.PreKeyMessage) {
            const preKeyMessage = envelope.message
            cipherMessage = preKeyMessage.message
            header = {
              senderIdentity,
              mac: envelope.mac,
              baseKey: preKeyMessage.base_key,
              isPreKeyMessage: true,
              sessionTag,
              messageByteLength
            }

            return new Envelope(header, cipherMessage)
          }

          cipherMessage = envelope.message as any
          header = {
            senderIdentity,
            mac: envelope.mac,
            baseKey: keys.KeyPair.new().public_key, // generate a new one
            isPreKeyMessage: false,
            sessionTag,
            messageByteLength
          }

          return new Envelope(header, cipherMessage)
        })()

        return {
          messageType: _messageType,
          usingSessionTag: _keymailEnvelope.header.sessionTag,
          keymailEnvelope: _keymailEnvelope,
          mac: envelope.mac
        }
      }
    })()

    transactionWillCreate()
    const messageId: string = `0x${sodium.to_hex(mac)}`
    this.messagesContract.publish(`0x${keymailEnvelope.encrypt(preKeyID, preKeyPublicKey)}`)
      .on('transactionHash', async (hash) => {
        if (closeSession) {
          return
        }
        transactionDidCreate(hash)
        const createNewSession = async () => {

          await this.db.createSession({
            user: currentUser,
            contact: {
              userAddress: toUserAddress,
              blockHash
            },
            messageId,
            subject,
            sessionTag: usingSessionTag,
            messageType,
            timestamp: nowTimestamp,
            plainText,
            isFromYourself,
            summary: `${
              isFromYourself ? 'Me: ' : ''
            }${plainText.slice(0, SUMMARY_LENGTH)}${plainText.length > SUMMARY_LENGTH ? '...' : ''}`,
            transactionHash: hash,
            status: MESSAGE_STATUS.DELIVERING,
          })
        }
        if (sessionTag !== usingSessionTag) {
          await createNewSession()
        } else {
          // cryptobox session corrupted
          const oldSession = await this.db.getSession(sessionTag, currentUser.userAddress)
          if (!oldSession) {
            await createNewSession()
          } else {
            await this.db.createMessage({
              messageId,
              user: currentUser,
              messageType,
              sessionTag,
              timestamp: nowTimestamp,
              plainText,
              isFromYourself,
              transactionHash: hash,
              status: MESSAGE_STATUS.DELIVERING,
            })
            await this.db.addContact(currentUser, {
              userAddress: toUserAddress,
              blockHash
            })
          }
        }

        if (sessionTag && this.currentSession && this.currentSession.sessionTag === sessionTag) {
          const newMessage = await this.db.getMessage(messageId, currentUser.userAddress) as Imessage
          const newSession = await this.db.getSession(sessionTag, currentUser.userAddress) as Isession
          runInAction(() => {
            if (sessionTag && this.currentSession && this.currentSession.sessionTag === sessionTag) {
              this.currentSessionMessages = this.currentSessionMessages.concat(newMessage)
              const index = this.currentUserSessions
                .findIndex((session1) => session1.sessionTag === sessionTag)
              this.currentSession = newSession
              this.currentUserSessions = [
                this.currentSession,
                ...this.currentUserSessions.slice(0, index),
                ...this.currentUserSessions.slice(index + 1)
              ]
            }

            if (!this.currentUserContacts.find((contact) => contact.userAddress === toUserAddress)) {
              this.currentUserContacts.push({
                userAddress: toUserAddress,
                blockHash
              })
              this.currentUserContacts = this.currentUserContacts.slice(0)
            }
          })
        } else {
          this.loadSessions()
        }
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          if (!receipt.events) {
            sendingDidFail(new Error('Unknown error'))
            return
          }
          sendingDidComplete()

          await this.db.getMessage(messageId, currentUser.userAddress)
            .then((message) => {
              if (message === undefined) {
                return
              }
              this.db.updateMessageStatus(message, MESSAGE_STATUS.DELIVERED)
            })

          if (this.currentSession === undefined || this.currentSession.sessionTag !== usingSessionTag) {
            return
          }

          const messages = await this.db.getMessages(usingSessionTag, currentUser.userAddress)
          if (messages === undefined) {
            return
          }
          runInAction(() => {
            this.currentSessionMessages = messages
          })
        }
      })
      .on('error', async (error: Error) => {
        sendingDidFail(error)
        await this.db.getMessage(messageId, currentUser.userAddress)
          .then(async (message) => {
            if (message === undefined) {
              return
            }
            this.db.updateMessageStatus(message, MESSAGE_STATUS.FAILED)
            if (this.currentSession === undefined || this.currentSession.sessionTag !== usingSessionTag) {
              return
            }

            const messages = await this.db.getMessages(usingSessionTag, currentUser.userAddress)
            runInAction(() => {
              this.currentSessionMessages = messages
            })
          })
      })
  }

  public dumpDB = () => {
    return this.db.dumpDB()
  }

  public publishBoradcastMessage = (
    message: string,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      sendingDidComplete = noop,
      sendingDidFail = noop
    }: IsendingLifecycle = {},
  ) => {
    const user = this.currentUser

    const signature = sodium.to_hex(this.box!.identity.secret_key.sign(message))
    const timestamp = Math.floor(Date.now() / 1000)
    const signedMessage: IsignedBroadcastMessage = {
        message,
        signature,
        timestamp,
    }
    const signedMessageHex = utf8ToHex(JSON.stringify(signedMessage))
    this.broadcastMessagesContract.publish(signedMessageHex, user!.userAddress)
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          if (!receipt.events) {
            sendingDidFail(new Error('Unknown error'))
            return
          }
          sendingDidComplete()
        }
      })
      .on('error', async (error: Error) => {
        sendingDidFail(error)
      })
  }

  public startFetchBroadcast = async () => {
    if (this.connectStatus !== ACTIVE || this.isFetchingBroadcast) {
      return
    }
    const fetNewBroadcastMessagesLoop = async () => {
      try {
        await this.fetchNewBroadcastMessages()
      } finally {
        runInAction(() => {
          this.fetchBroadcastMessagesTimeout = window.setTimeout(
            fetNewBroadcastMessagesLoop,
            FETCH_BROADCAST_MESSAGES_INTERVAL)
        })
      }
    }

    runInAction(() => {
      this.isFetchingBroadcast = true
      this.fetchBroadcastMessagesTimeout = window.setTimeout(fetNewBroadcastMessagesLoop, 0)
    })
  }

  public startFetchMessages = () => {
    if (this.connectStatus !== ACTIVE) {
      return
    }
    let isOutdatedPrekeysDeleted = false

    const fetchNewMessagesLoop = async () => {
      if (this.connectStatus !== ACTIVE || !this.isFetchingMessage) {
        return
      }

      try {
        const web3 = getWeb3()
        const currentBlockNumber = await web3.eth.getBlockNumber()

        if (currentBlockNumber !== this.currentUserlastFetchBlock) {
          await this.fetchNewMessages()

          if (!isOutdatedPrekeysDeleted) {
            this.deleteOutdatedPrekeys()
            isOutdatedPrekeysDeleted = true
          }
        }
      } finally {
        runInAction(() => {
          this.fetchMessagesTimeout = window.setTimeout(fetchNewMessagesLoop, FETCH_MESSAGES_INTERVAL)
        })
      }
    }
    runInAction(() => {
      this.isFetchingMessage = true
      this.fetchMessagesTimeout = window.setTimeout(fetchNewMessagesLoop, 0)
    })
  }

  public stopFetchBroadcastMessages = () => {
    runInAction(() => {
      this.isFetchingBroadcast = false
      window.clearTimeout(this.fetchBroadcastMessagesTimeout)
    })
  }
  public stopFetchMessages = () => {
    runInAction(() => {
      this.isFetchingMessage = false
      window.clearTimeout(this.fetchMessagesTimeout)
    })
  }

  public loadSessions = async () => {
    if (!this.currentUser) {
      return
    }
    const {
      networkId,
      userAddress,
    } = this.currentUser
    const updatedUser = await this.db.getUser(networkId, userAddress) as Iuser
    const sessions = await this.db.getSessions(updatedUser)
    runInAction(() => {
      this.currentUserSessions = sessions

      const updatedContacts = updatedUser.contacts
      if (updatedContacts.length !== this.currentUserContacts.length) {
        this.currentUserContacts = updatedContacts
      }
      this.newMessageCount = 0
    })
  }

  public selectSession = async (session: Isession) => {
    const messages = await this.db.getMessages(session.sessionTag, session.userAddress)
    const newSession = await this.db.getSession(session.sessionTag, session.userAddress) as Isession
    const oldUnreadCount = session.unreadCount
    const newUnreadCount = newSession.unreadCount
    const unreadCount = newUnreadCount - oldUnreadCount
    if (newUnreadCount > 0) {
      await this.db.clearSessionUnread(session)
      session.unreadCount = 0
      session.isClosed = newSession.isClosed
      session.lastUpdate = newSession.lastUpdate
      session.summary = newSession.summary
    }
    runInAction(() => {
      if (this.newMessageCount > 0 && unreadCount > 0) {
        if (unreadCount < this.newMessageCount) {
          const index = this.currentUserSessions.findIndex((_session) => _session.sessionTag === session.sessionTag)
          this.currentUserSessions = [
            session,
            ...this.currentUserSessions.slice(0, index),
            ...this.currentUserSessions.slice(index + 1)
          ]
          this.newMessageCount -= unreadCount
        } else {
          this.loadSessions()
        }
      }
      this.currentUserSessions = this.currentUserSessions.slice(0)
      this.currentSessionMessages = messages
      this.currentSession = session
    })
  }

  public unselectSession = () => {
    runInAction(() => {
      this.currentSession = undefined
      this.currentSessionMessages = []
    })
  }

  public currentUserSign = (message: string) => {
    if (typeof this.box === 'undefined') {
      return ''
    }
    return sodium.to_hex(this.box.identity.secret_key.sign(message))
  }

  public deleteSession = async (session: Isession, user: Iuser) => {
    await this.db.deleteSession(user, session)
    runInAction(() => {
      if (this.currentUser && this.currentUser.userAddress === user.userAddress) {
        if (
          this.currentSession
          && this.currentSession.userAddress === user.userAddress
          && this.currentSession.sessionTag === session.sessionTag
        ) {
          this.currentSession = undefined
        }
        this.currentUserSessions = this.currentUserSessions
          .filter((_session) => _session.sessionTag !== session.sessionTag)
      }
    })
  }

  private getPreKeys = async (userAddress: string) => {
    const uploadPreKeysUrl = process.env.REACT_APP_KVASS_ENDPOINT + userAddress
    const init = { method: 'GET', mode: 'cors' } as RequestInit
    const userIdentity = await this.identitiesContract.getIdentity(userAddress)
    const userPublicKey = generatePublicKeyFromHexStr(userIdentity.publicKey.slice(2))

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

  private updateLastFetchBlockOfBroadcast = async (lastBlock: number, user: Iuser) => {
      const _newLastBlock = lastBlock < 3 ? 0 : lastBlock - 3
      await this.db.updateLastFetchBlockOfBroadcast(user, _newLastBlock)
      runInAction(() => {
        this.currentUserlastFetchBlockOfBroadcast = _newLastBlock
      })
  }

  private fetchNewBroadcastMessages = async (
    lastFetchBlock = this.currentUserlastFetchBlockOfBroadcast
  ) => {
    const {
      lastBlock,
      broadcastMessages
    } = await this.broadcastMessagesContract.getBroadcastMessages({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0
    })

    let messages = (await Promise.all(broadcastMessages.map(async (message: any) => {
      const userAddress = message.userAddress
      const blockTimestamp = message.timestamp
      const signedMessage = JSON.parse(hexToUtf8(message.signedMessage.slice(2))) as IsignedBroadcastMessage
      if (this.broadcastMessagesSignatures.includes(signedMessage.signature)) {
        return null
      }

      this.broadcastMessagesSignatures.push(signedMessage.signature)

      const userIdentity = await this.identitiesContract.getIdentity(userAddress)
      const userPublicKey = generatePublicKeyFromHexStr(userIdentity.publicKey.slice(2))
      if (!userPublicKey.verify(sodium.from_hex(signedMessage.signature), signedMessage.message)) {
        storeLogger.error(new Error('invalid signature'))
        return null
      }

      const isInvalidTimestamp = Math.abs(signedMessage.timestamp - blockTimestamp) >= 10 * 60

      const m = {
        message: signedMessage.message,
        timestamp: Number(signedMessage.timestamp) * 1000,
        author: userAddress,
        isInvalidTimestamp,
      } as IreceviedBroadcastMessage
      if (isInvalidTimestamp) {
        m.blockTimestamp = Number(blockTimestamp) * 1000
      }
      return m
    }))).filter((m) => m !== null) as IreceviedBroadcastMessage[]

    if (messages.length > 0) {
      runInAction(() => {
        this.broadcastMessages = this.broadcastMessages.concat(messages)
      })
    }

    const user = this.currentUser as Iuser
    await this.updateLastFetchBlockOfBroadcast(lastBlock, user)
  }

  private fetchNewMessages = async (
    lastFetchBlock = this.currentUserlastFetchBlock
  ) => {
    const {
      lastBlock,
      messages
    } = await this.messagesContract.getMessages({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0
    })

    const user = this.currentUser as Iuser

    if (messages.length === 0) {
      const _newLastBlock = lastBlock < 3 ? 0 : lastBlock - 3
      await this.db.updateLastFetchBlock(user, _newLastBlock)
      runInAction(() => {
        this.currentUserlastFetchBlock = _newLastBlock
      })
      return
    }

    const newReceivedMessages = (await Promise.all(messages
      .map((message) => this.decryptMessage(message).catch(() => null))))
      .filter((message) => message !== null) as IreceivedMessage[]

    let unreadMessagesLength = newReceivedMessages.length
    await Promise.all(
      newReceivedMessages.map((message) => {
        const plainText = message.plainText as string
        switch (message.messageType) {
          case MESSAGE_TYPE.HELLO:
            return this.db.createSession(Object.assign({}, message, {
              messageId: `0x${sodium.to_hex(message.mac)}`,
              user,
              contact: {
                blockHash: message.blockHash as string,
                userAddress: message.fromUserAddress as string,
              },
              summary: `${plainText.slice(0, SUMMARY_LENGTH)}${plainText.length > SUMMARY_LENGTH ? '...' : ''}`,
              status: MESSAGE_STATUS.DELIVERED,
            }))
          default:
            const sessionTag = message.sessionTag
            if (this.currentSession && this.currentSession.sessionTag === sessionTag) {
              return this.db.createMessage(Object.assign({}, message, {
                  messageId: `0x${sodium.to_hex(message.mac)}`,
                  user,
                  plainText: message.plainText as string,
                  shouldAddUnread: false,
                  transactionHash: '',
                  status: MESSAGE_STATUS.DELIVERED,
                }))
                  .then(() => this.db.getMessages(sessionTag, user.userAddress))
                  .then(async (_messages) => {
                    const sessionInDB = await this.db.getSession(sessionTag, user.userAddress)
                    runInAction(() => {
                      if (this.currentSession && this.currentSession.sessionTag === sessionTag) {
                        this.currentSessionMessages = _messages
                        const index = this.currentUserSessions
                          .findIndex((session) => session.sessionTag === sessionTag)
                        if (sessionInDB !== undefined) {
                          this.currentSession = sessionInDB
                        }
                        if (typeof  this.currentSession === 'undefined') {
                          return
                        }
                        this.currentUserSessions = [
                          this.currentSession,
                          ...this.currentUserSessions.slice(0, index),
                          ...this.currentUserSessions.slice(index + 1)
                        ]
                        unreadMessagesLength--
                      }
                    })
              })
            } else {
              return this.db.createMessage(Object.assign({}, message, {
                messageId: `0x${sodium.to_hex(message.mac)}`,
                user,
                plainText: message.plainText as string,
                transactionHash: '',
                status: MESSAGE_STATUS.DELIVERED,
              }))
            }
        }
      })
    )
    const newLastBlock = lastBlock < 3 ? 0 : lastBlock - 3
    await this.db.updateLastFetchBlock(user, newLastBlock)
    runInAction(() => {
      this.currentUserlastFetchBlock = newLastBlock
      if (unreadMessagesLength > 0) {
        this.newMessageCount += unreadMessagesLength
      }
    })
  }

  private decryptMessage = async ({
    message: encryptedConcatedBufferStr,
    timestamp
  }: ItrustbaseRawMessage) => {
    const box = this.box as Cryptobox
    const concatedBuf = sodium.from_hex(encryptedConcatedBufferStr.slice(2)) // Uint8Array
    const preKeyID = new Uint16Array(concatedBuf.slice(0, PRE_KEY_ID_BYTES_LENGTH).buffer)[0]
    const preKey = await (this.indexedDBStore as IndexedDBStore).load_prekey(preKeyID)

    const keymailEnvelope = Envelope.decrypt(
      concatedBuf.slice(PRE_KEY_ID_BYTES_LENGTH),
      preKey
    )

    const proteusEnvelope: proteusMessage.Envelope = getEmptyEnvelope()
    const {
      senderIdentity,
      mac,
      baseKey,
      sessionTag,
      isPreKeyMessage,
      messageByteLength
    } = keymailEnvelope.header

    proteusEnvelope.mac = mac
    proteusEnvelope._message_enc = (() => {
      if (isPreKeyMessage) {
        return new Uint8Array((proteusMessage.PreKeyMessage.new(
          preKeyID,
          baseKey,
          senderIdentity,
          keymailEnvelope.cipherMessage
        ) as any).serialise())
      }
      return new Uint8Array((keymailEnvelope.cipherMessage as any).serialise())
    })()

    await box.session_load(sessionTag).catch((err) => {
      if (err.name !== 'RecordNotFoundError') {
        // Maybe we have a corrupted session on local, delete it.
        return Promise.all([
          box.session_delete(sessionTag),
          this.db.getSession(sessionTag, (this.currentUser as Iuser).userAddress).then((session) => {
            if (session) {
              return this.db.deleteSession(this.currentUser as Iuser, session)
            }
            return
          })
        ]) as any
      }
      return
    })

    return box.decrypt(sessionTag, proteusEnvelope.serialise())
      .then((decryptedPaddedMessage) => this.deserializeMessage({
        decryptedPaddedMessage,
        senderIdentity,
        timestamp,
        messageByteLength
      }))
      .then((message) => Object.assign(message, {
        mac,
        sessionTag
      }))
  }

  private deserializeMessage = async ({
    decryptedPaddedMessage,
    senderIdentity,
    timestamp: blockTimestampSecStr,
    messageByteLength
  }: IdecryptedTrustbaseMessage) => {
    const unpaddedMessage = unpad512BytesMessage(decryptedPaddedMessage, messageByteLength)
    const {
      subject,
      messageType,
      fromUserAddress,
      plainText,
      timestamp
    } = JSON.parse(unpaddedMessage) as IrawUnppaddedMessage

    let blockHash
    if (fromUserAddress) {
      const {
        blockNumber,
        publicKey: expectedFingerprint
      } = await this.identitiesContract.getIdentity(fromUserAddress)

      const web3 = getWeb3()
      blockHash = await web3.eth.getBlock(blockNumber)
        .then((block) => block.hash).catch((err) => {
          storeLogger.error(err)
          return '0x0'
        })

      if (expectedFingerprint !== `0x${senderIdentity.fingerprint()}`) {
        const err = new Error('Invalid message: sender identity not match')
        storeLogger.error(err)
        throw err
      }

      if (messageType === MESSAGE_TYPE.HELLO && this.box && this.indexedDBStore) {
        this.box = new Cryptobox(this.indexedDBStore as any, 0)
        this.box.load()
      }
    }

    const blockTimestamp = Number(blockTimestampSecStr) * 1000
    if (blockTimestamp > timestamp + 3600 * 1000 || blockTimestamp < timestamp - 3600 * 1000) {
      const err = new Error('Invalid message: timstamp is not trusted')
      storeLogger.error(err)
      throw err
    }

    return {
      messageType,
      subject,
      timestamp,
      fromUserAddress,
      blockHash,
      plainText
    }
  }

  private deleteOutdatedPrekeys = async () => {
    const store = this.indexedDBStore as IndexedDBStore
    const preKeysFromStorage = await store.load_prekeys()
    const today = unixToday()
    return Promise.all(preKeysFromStorage
      .filter((preKey) => Number(preKey.key_id) < today)
      .map((preKeyToDelete) => store.deletePrekey(preKeyToDelete.key_id)))
  }
}

function getPreKey({
  interval,
  lastPrekeyDate,
  preKeyPublicKeys
}: {
  interval: number,
  lastPrekeyDate: number,
  preKeyPublicKeys: IpreKeyPublicKeys
}) {
  let preKeyPublicKeyString
  let preKeyID = unixToday()
  if (preKeyID > lastPrekeyDate) {
    preKeyID = lastPrekeyDate
    preKeyPublicKeyString = preKeyPublicKeys[preKeyID]
  } else {
    const limitDay = preKeyID - interval
    while (preKeyID > limitDay && preKeyPublicKeyString === undefined) {
      preKeyPublicKeyString = preKeyPublicKeys[preKeyID]
      preKeyID -= 1
    }
    preKeyID += 1

    // If not found, use last-resort pre-key
    if (preKeyPublicKeyString === undefined) {
      preKeyID = lastPrekeyDate
      preKeyPublicKeyString = preKeyPublicKeys[lastPrekeyDate]
    }
  }

  const publicKey = generatePublicKeyFromHexStr(preKeyPublicKeyString.slice(2))
  return {
    id: preKeyID,
    publicKey
  }
}

function identityKeyFromHexStr(identityKeyHexString: string) {
  return keys.IdentityKey.new(generatePublicKeyFromHexStr(identityKeyHexString))
}

function padTo512Bytes(plaintext: string) {
  const typeArrayText = sodium.from_string(plaintext)
  const messageByteLength: number = typeArrayText.byteLength
  if (messageByteLength >= 512) {
    throw new RangeError('Message too large')
  }
  const result = new Uint8Array(512).fill(0xFF)
  result.set(typeArrayText)
  return {
    result,
    messageByteLength
  }
}

function unpad512BytesMessage(padded512BytesMessage: Uint8Array, messageByteLength: number) {
  return sodium.to_string(padded512BytesMessage.subarray(
    0,
    messageByteLength
  ))
}

function makeSessionTag() {
  return `0x${sodium.to_hex(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))))}`
}

function getEmptyEnvelope() {
  const aValidEnvelope = proteusMessage.Envelope
    .deserialise(sodium.from_hex(
      'a3000101a100582008071b607d3fbbe7f11d3f92312cca2f15acdef7e9895d61a364924ce59e9bc902589502a4001944'
      + '3a01a10058206f5fcfc5e6009b64f33b2566ec56ec8ac35c115664f899322d65b5f13ad4b99c02a100a10058200652d3'
      + '46c72a8995677347028917f55ad18b3898aed4ac8ed984e43857e35b8f03a5005054c4b855b93b737e30c9f4dd891a3b'
      + '330111020003a1005820dc9884435f77974e03ce9a04b7158f13f2576b9f5e2decc7bf881febb90c7f7e0444279808e9'
    ).buffer)
  const emptyEnvelope = Object.create(Object.getPrototypeOf(aValidEnvelope))
  emptyEnvelope.version = 1
  return emptyEnvelope
}

const SUMMARY_LENGTH = 32
