import {
  observable,
  computed,
  runInAction,
  useStrict
} from 'mobx'

import {
  initialize,
  getUsernameHash,
  getWeb3,
  Identities,
  PreKeys,
  Messages,
  TrustbaseError
} from 'trustbase'

import { keys, message as proteusMessage } from 'wire-webapp-proteus'
import { Cryptobox, CryptoboxSession } from 'wire-webapp-cryptobox'

const ed2curve = require('ed2curve')
const sodium = require('libsodium-wrappers')

import DB from './DB'
import IndexedDBStore from './IndexedDBStore'
import PreKeysPackage from './PreKeysPackage'
import PreKeyBundle from './PreKeyBundle'
import Envelope from './Envelope'

import {
  web3BlockType,
  IpreKeyPublicKeys,
  IglobalSettings,
  Isession,
  IregisterLifecycle,
  IasyncProvider,
  IcheckRegisterLifecycle,
  IuploadPreKeysLifecycle,
  InetworkSettings,
  IsendingLifecycle,
  IenvelopeHeader,
  Iuser,
  ItrustbaseRawMessage,
  IdecryptedTrustbaseMessage,
  IrawUnppaddedMessage,
  IreceivedMessage,
  Imessage,
  Icontact,
  IcheckMessageStatusLifecycle,
  IDumpedDatabases,
} from '../typings/interface.d'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  SENDING_FAIL_CODE,
  NETWORKS,
  MESSAGE_TYPE,
  LOCAL_STORAGE_KEYS,
  FETCH_MESSAGES_INTERVAL,
  PRE_KEY_ID_BYTES_LENGTH,
  SUMMARY_LENGTH,
  USER_STATUS,
  MESSAGE_STATUS
} from './constants'
import { dumpCryptobox } from './utils';

const {
  IdentityKeyPair,
  PreKey
} = keys

const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

const noop = () => { /* FOR LINT */ }
useStrict(true)

const SESSION_PRE_PAGE = 25

type IloadedUserData = [
  Iuser | undefined,
  [
    IndexedDBStore | undefined,
    Cryptobox | undefined
  ],
  Icontact[],
  web3BlockType
]

type TypeConnectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => void

export class Store {
  @observable public connectStatus: TRUSTBASE_CONNECT_STATUS = PENDING
  @observable public lastConnectStatus: TRUSTBASE_CONNECT_STATUS = PENDING
  @observable public connectError: Error
  @observable.ref public globalSettings: IglobalSettings = {}
  @observable public currentEthereumNetwork: NETWORKS | undefined
  @observable public currentEthereumAccount = ''
  @observable.ref public offlineAvailableNetworks: NETWORKS[] = []
  @observable public offlineSelectedEthereumNetwork: NETWORKS | undefined
  @observable.ref public currentNetworkSettings: InetworkSettings | undefined
  @observable.ref public currentNetworkUsers: Iuser[] = []
  @observable.ref public currentUser: Iuser | undefined
  @observable.ref public currentUserContacts: Icontact[] = []
  @observable.ref public currentUserSessions: Isession[] = []
  @observable public newMessageCount = 0
  @observable.ref public currentSession: Isession | undefined
  @observable.ref public currentSessionMessages: Imessage[] = []
  @observable.ref public registeringUsers: Iuser[] = []
  @observable public isFetchingMessage = false
  private connectStatusListener: TypeConnectStatusListener[] = []
  private currentUserlastFetchBlock: web3BlockType = 0
  private indexedDBStore: IndexedDBStore | undefined
  private box: Cryptobox | undefined
  private identitiesContract: Identities
  private preKeysContract: PreKeys
  private messagesContract: Messages
  private detectAccountChangeTimeout: number
  private fetchMessagesTimeout: number
  private db: DB

  constructor() {
    this.db = new DB()
  }

  @computed
  public get pageLength() {
    return Math.ceil(this.currentUserSessions.length / SESSION_PRE_PAGE)
  }

  public connectTrustbase = async () => {
    // read global settings from local storage
    const globalSettings = await this.db.getGlobalSettings()

    const provider = (() => {
      // Check settings first
      const _provider = globalSettings.provider || ''
      if (_provider === '') {
        const _window = window as any
        const _web3 = _window.web3
        // Checking if Web3 has been injected
        if (typeof _web3 !== 'undefined') {
          // Use injected provider
          return _web3.currentProvider as IasyncProvider
        } else {
          // fallback - try to connect local node
          return 'http://localhost:8545'
        }
      }
      return _provider
    })()

    return initialize({
      provider
    })
      .then(async () => this.processAfterNetworkConnected(true, globalSettings))
      .catch(async (err) => {
        /**
         * Offline mode
         */
        let {
          networkId: lastUsedNetworkId
          // usernamHash: lastUsedUsernameHash
        } = getLastUsedUser()

        if (err.code === TrustbaseError.CODE.FOUND_NO_ACCOUNT) {
          /**
           * We did have connected to a network and instantiated web3 but
           * found no account. Just wait for a available account.
           */
          const web3 = getWeb3()
          const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch(() => undefined)
          let loadedResult: [InetworkSettings, Iuser[], IloadedUserData]
          if (typeof currentNetworkId !== 'undefined') {
            const usernameHash: string = getNetworkLastUsedUsernameHash(currentNetworkId)
            loadedResult = await Promise.all([
              // currentNetworkSettings
              this.db.getNetworkSettings(currentNetworkId),
              // currentNetworkUsers
              this.db.getUsers(currentNetworkId),
              // *userData
              this.db.getUser(currentNetworkId, usernameHash)
                .catch(() => this.currentUser)
                .then((currentUser) => this.loadUserData(currentUser))
            ])
          }

          runInAction(() => {
            this.globalSettings = globalSettings
            this.currentEthereumNetwork = currentNetworkId
            if (typeof currentNetworkId !== 'undefined') {
              {[
                this.currentNetworkSettings,
                this.currentNetworkUsers,
                [
                  this.currentUser,
                  [
                    this.indexedDBStore,
                    this.box
                  ],
                  this.currentUserContacts,
                  this.currentUserlastFetchBlock
                ]
              ] = loadedResult}
            }
            const prevConnectStatus = this.connectStatus
            this.connectStatus = NO_ACCOUNT
            this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
          })

          const waitForAccount = async () => {
            const accounts = await web3.eth.getAccounts().catch(() => [] as string[])
            if (accounts.length > 0) {
              return this.processAfterNetworkConnected()
            }
            return window.setTimeout(waitForAccount, 100)
          }
          window.setTimeout(waitForAccount, 100)
        } else {
          /**
           * In this case, we can't instantiate web3, user need to refresh the
           * page to retry.
           */
          const usedNetworks: NETWORKS[] = getUsedNetworks()
          if (!lastUsedNetworkId && usedNetworks.length > 0) {
            lastUsedNetworkId = usedNetworks[0]
          }
          if (typeof lastUsedNetworkId !== 'undefined') {
            this.selectOfflineNetwork(lastUsedNetworkId, false, true, globalSettings, err)
          } else {
            runInAction(() => {
              this.globalSettings = globalSettings
              this.offlineAvailableNetworks = usedNetworks
              this.offlineSelectedEthereumNetwork = lastUsedNetworkId
              const prevConnectStatus = this.connectStatus
              this.connectStatus = ERROR
              this.connectError = err
              this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
            })
          }
        }
      })
  }

  public register = async (username: string, {
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    userDidCreate = noop,
    registerDidFail = noop
  }: IregisterLifecycle = {}) => new Promise(async (resolve, reject) => {
    if (this.connectStatus !== SUCCESS) {
      return registerDidFail(null, REGISTER_FAIL_CODE.NOT_CONNECTED)
    }

    if (username === '' || username.length < 1 || username.length > 16) {
      return registerDidFail(null, REGISTER_FAIL_CODE.INVALID_USERNAME)
    }

    const usernameHash = getUsernameHash(username)
    // Check local records first.
    if (Object.keys(this.currentNetworkUsers).includes(username)) {
      return registerDidFail(null, REGISTER_FAIL_CODE.FOUND_ON_LOCAL)
    }

    // connectStatus === SUCCESS means we had connected to a network
    const currentNetworkId = this.currentEthereumNetwork as NETWORKS

    // check if registered, avoid unnecessary transaction
    const {
      publicKey: identityFingerprint
    } = await this.identitiesContract.getIdentity(username)
    if (Number(identityFingerprint) !== 0) {
      return registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
    }

    const identityKeyPair = IdentityKeyPair.new()
    const newIdentityFingerprint = `0x${identityKeyPair.public_key.fingerprint()}`

    transactionWillCreate()
    this.identitiesContract.register(username, newIdentityFingerprint)
      .on('transactionHash', async (transactionHash) => {
        transactionDidCreate(transactionHash)
        const store = new IndexedDBStore(usernameHash)
        await store.save_identity(identityKeyPair).catch(reject)
        const lastResortPrekey = PreKey.last_resort()
        await store.save_prekeys([lastResortPrekey]).catch(reject)
        this.db.createUser({
          networkId: currentNetworkId,
          username,
          usernameHash,
          owner: this.currentEthereumAccount
        }, {
          identityTransactionHash: transactionHash,
          identity: sodium.to_hex(new Uint8Array(identityKeyPair.serialise()))
        })
          .then(async () => {
            const createdUser = await this.db.getUser(currentNetworkId, usernameHash).catch(reject)
            if (createdUser) {
              this.useUser(createdUser).then(userDidCreate).catch(noop)
              runInAction(() => {
                this.currentNetworkUsers = this.currentNetworkUsers.concat(createdUser)
              })
              return resolve()
            }
          })
          .catch(reject)
      })
      .on('error', async (err) => {
        const createdUser = await this.db.getUser(currentNetworkId, usernameHash).catch(() => undefined)
        if (createdUser) {
          this.db.deleteUser(createdUser).catch(noop)
        }
        reject(err)
      })
  }).catch(registerDidFail)

  public checkMessageStatus = async (
    message: Imessage,
    {
      deliveryFailed = noop,
    }: IcheckMessageStatusLifecycle = {}
  ) => {
    if (message.transactionHash === undefined) {
      return
    }
    const txHash: string = message.transactionHash

    const web3 = getWeb3()
    const waitForTransactionReceipt = async (counter = 0) => {
      if (this.connectStatus !== SUCCESS) {
        return
      }
      const receipt = await web3.eth.getTransactionReceipt(txHash)
        .catch(() => null)
      if (receipt !== null) {
        if (counter >= CONFIRMATION_NUMBER) {
          this.db.updateMessageStatus(message, MESSAGE_STATUS.DELIVERED)
            .then(async () => {
              if (this.currentSession !== undefined && message.sessionTag === this.currentSession.sessionTag) {
                const _messages = await this.db.getMessages(message.sessionTag).catch(() => [])
                if (_messages.length !== 0) {
                  runInAction(() => {
                    this.currentSessionMessages = _messages
                  })
                }
              }
            })
            .catch(() => {
              // console.log("update message status to DELIVERED error")
            })
          return
        } else {
          window.setTimeout(waitForTransactionReceipt, 1000, counter + 1)
          return
        }
      }

      if (counter === 50) {
        return deliveryFailed()
      }

      window.setTimeout(waitForTransactionReceipt, 1000, counter)
    }

    return waitForTransactionReceipt()
  }

  public checkRegister = async (
    user: Iuser,
    {
      checkRegisterWillStart = noop,
      registerDidFail = noop
    }: IcheckRegisterLifecycle = {}
  ) => {
    if (this.connectStatus !== SUCCESS) {
      return registerDidFail(null, REGISTER_FAIL_CODE.NOT_CONNECTED)
    }

    if (!user.registerRecord) {
      return registerDidFail(new Error('Register record not found'))
    }

    const {
      username,
      registerRecord: {
        identityTransactionHash,
        identity: keyPairHexString
      }
    } = user
    const identityKeyPair = IdentityKeyPair.deserialise(sodium.from_hex(keyPairHexString).buffer)

    const web3 = getWeb3()
    checkRegisterWillStart(identityTransactionHash)
    const waitForTransactionReceipt = async (counter = 0) => {
      if (this.connectStatus !== SUCCESS) {
        return
      }
      const receipt = await web3.eth.getTransactionReceipt(identityTransactionHash)
        .catch(() => null)
      if (receipt !== null) {
        if (counter >= CONFIRMATION_NUMBER) {
          const {
            blockNumber,
            publicKey: registeredIdentityFingerprint
          } = await this.identitiesContract.getIdentity(username)
            .catch(() => {
              return {publicKey: '', blockNumber: 0}
            })
          if (!registeredIdentityFingerprint) {
            return window.setTimeout(waitForTransactionReceipt, 1000, counter)
          }
          if (registeredIdentityFingerprint === `0x${identityKeyPair.public_key.fingerprint()}`) {
            const blockHash = await web3.eth.getBlock(blockNumber).then((block) => block.hash).catch((err) => {
              registerDidFail(err)
              return '0x0'
            })
            if (blockHash === '0x0') {
              return
            }
            user.blockHash = blockHash
            await this.db.updateUserStatus(user, USER_STATUS.IDENTITY_UPLOADED).catch(registerDidFail)
            runInAction(() => {
              if (this.currentUser && this.currentUser.usernameHash === user.usernameHash) {
                this.currentUser = Object.assign({}, this.currentUser, {status: USER_STATUS.IDENTITY_UPLOADED})
                const index = this.currentNetworkUsers
                .findIndex((_user) => _user.usernameHash === (this.currentUser as Iuser).usernameHash)
                if (index !== -1) {
                  this.currentNetworkUsers[index] = this.currentUser
                  this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
                }
              }
            })
            return
          } else {
            this.db.deleteUser(user).catch(noop)
            return registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
          }
        } else {
          window.setTimeout(waitForTransactionReceipt, 1000, counter + 1)
          return
        }
      }

      if (counter === 50) {
        return registerDidFail(null, REGISTER_FAIL_CODE.TIMEOUT)
      }

      window.setTimeout(waitForTransactionReceipt, 1000, counter)
    }

    return waitForTransactionReceipt()
  }

  public send = async (
    toUsername: string,
    subject: string,
    plainText: string,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      sendingDidComplete = noop,
      sendingDidFail = noop
    }: IsendingLifecycle = {},
    sessionTag = ''
  ) => {
    switch (true) {
      case this.connectStatus !== SUCCESS:
        return sendingDidFail(null, SENDING_FAIL_CODE.NOT_CONNECTED)
      case toUsername === '':
        return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USERNAME)
      case plainText === '':
        return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_MESSAGE)
    }

    if (!this.box) {
      // just for type checker, should never enter this block
      return sendingDidFail(new Error('Could not found cryptobox instance'))
    }

    const currentUser = this.currentUser as Iuser

    const web3 = getWeb3()
    const toUsernameHash = web3.utils.sha3(toUsername)
    const {
      publicKey: identityFingerprint,
      blockNumber
    } = await this.identitiesContract.getIdentity(toUsernameHash, { isHash: true })
      .catch((err) => {
        sendingDidFail(err)
        return {publicKey: undefined, blockNumber: 0}
      })
    const blockHash = await web3.eth.getBlock(blockNumber).then((block) => block.hash).catch(() => '0x0')
    if (!identityFingerprint || blockHash === '0x0') {
      return
    }
    if (Number(identityFingerprint) === 0) {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USERNAME)
    }

    let session: CryptoboxSession | null = null
    if (sessionTag !== '') {
      // Is reply
      // Try to load local session and save to cache..
      session = await this.box.session_load(sessionTag).catch((err) => {
        if (err.name !== 'RecordNotFoundError') {
          // Maybe we have a corrupted session on local, delete it.
          return Promise.all([
            (this.box as Cryptobox).session_delete(sessionTag).then(noop),
            this.db.getSession(sessionTag, currentUser.usernameHash).then((_session) => {
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

    const {
      interval,
      lastPrekeyDate,
      preKeyPublicKeys
    } = await this.getPreKeys(toUsernameHash, true).catch(() => new PreKeysPackage({}, 0, 0))
    if (Object.keys(preKeyPublicKeys).length === 0) {
      sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USERNAME)
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

    const fromUsername = currentUser.username
    const senderIdentity = (this.box as Cryptobox).identity.public_key
    const isFromYourself = true
    const {
      messageType,
      usingSessionTag,
      keymailEnvelope
    } = await (async () => {
      // New conversation
      if (session === null) {
        const _messageType = MESSAGE_TYPE.HELLO
        const {
          result: paddedMessage,
          messageByteLength
        } = padTo512Bytes(JSON.stringify({
          subject,
          messageType: _messageType,
          fromUsername,
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
          keymailEnvelope: new Envelope(header, cipherMessage)
        }
      } else {
        const _messageType = MESSAGE_TYPE.NORMAL
        const {
          result: paddedMessage,
          messageByteLength
        } = padTo512Bytes(JSON.stringify({
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
          keymailEnvelope: _keymailEnvelope
        }
      }
    })()

    transactionWillCreate()
    const timestamp: number = Math.round(Date.now() / 1000)
    await this.messagesContract.publish(`0x${keymailEnvelope.encrypt(preKeyID, preKeyPublicKey)}`)
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
        const createNewSession = async () => {
          await this.db.createSession({
            user: currentUser,
            contact: {
              username: toUsername,
              usernameHash: toUsernameHash,
              blockHash
            },
            subject,
            sessionTag: usingSessionTag,
            messageType,
            timestamp,
            plainText,
            isFromYourself,
            summary: `${
              isFromYourself ? 'Me:' : ''
            }${plainText.slice(0, SUMMARY_LENGTH)}${plainText.length > SUMMARY_LENGTH ? '...' : ''}`,
            transactionHash: hash,
            status: MESSAGE_STATUS.DELIVERING,
          })
        }
        if (sessionTag !== usingSessionTag) {
          await createNewSession()
        } else {
          // cryptobox session corrupted
          const oldSession = await this.db.getSession(sessionTag, currentUser.usernameHash)
          if (!oldSession) {
            await createNewSession()
          } else {
            await this.db.createMessage({
              user: currentUser,
              messageType,
              sessionTag,
              timestamp,
              plainText,
              isFromYourself,
              transactionHash: hash,
              status: MESSAGE_STATUS.DELIVERING,
            })
            await this.db.addContact(currentUser, {
              username: toUsername,
              usernameHash: toUsernameHash,
              blockHash
            })
          }
        }

        if (sessionTag && this.currentSession && this.currentSession.sessionTag === sessionTag) {
          const newMessage = await this.db.getMessage(sessionTag, timestamp) as Imessage
          const newSession = await this.db.getSession(sessionTag, currentUser.usernameHash) as Isession
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

            if (!this.currentUserContacts.find((contact) => contact.usernameHash === toUsernameHash)) {
              this.currentUserContacts.push({
                username: toUsername,
                usernameHash: toUsernameHash,
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
        if (confirmationNumber === CONFIRMATION_NUMBER) {
          if (!receipt.events) {
            sendingDidFail(new Error('Unknown error'))
            return
          }
          sendingDidComplete()

          await this.db.getMessage(usingSessionTag, timestamp)
            .then((message) => {
              if (message === undefined) {
                return
              }
              this.db.updateMessageStatus(message, MESSAGE_STATUS.DELIVERED)
            })
            .catch(() => {
              // console.log("confirmation get message error", error)
            })

          if (this.currentSession === undefined || this.currentSession.sessionTag !== usingSessionTag) {
            return
          }

          const messages = await this.db.getMessages(usingSessionTag).catch(() => undefined)
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
        await this.db.getMessage(usingSessionTag, timestamp)
          .then(async (message) => {
            if (message === undefined) {
              return
            }
            this.db.updateMessageStatus(message, MESSAGE_STATUS.FAILED)
            if (this.currentSession === undefined || this.currentSession.sessionTag !== usingSessionTag) {
              return
            }

            const messages = await this.db.getMessages(usingSessionTag).catch(() => undefined)
            if (messages === undefined) {
              return
            }
            runInAction(() => {
              this.currentSessionMessages = messages
            })
          })
      })
  }

  public useUser = async (user: Iuser, shouldRefreshSessions = false, redirect?: () => void) => {
    const networkId = this.currentEthereumNetwork || this.offlineSelectedEthereumNetwork as NETWORKS
    const userData = await this.loadUserData(user)
    const sessions = shouldRefreshSessions ? await this.db.getSessions(userData[0] as Iuser) : undefined
    runInAction(() => {
      [
        this.currentUser,
        [
          this.indexedDBStore,
          this.box,
        ],
        this.currentUserContacts,
        this.currentUserlastFetchBlock
      ] = userData
      if (sessions) {
        this.currentUserSessions = sessions
      }
      this.newMessageCount = 0
      addUsedNetwork(networkId)
      setLastUsedUser(networkId, user.usernameHash)
      if (redirect) {
        redirect()
      }
    })
  }

  public dumpCurrentUser = async () => {
    const dbs: IDumpedDatabases = {}
    const user = this.currentUser
    if (user === undefined) {
      return
    }
    const sessions = this.currentUserSessions
    const messages = await this.db.getUserMessages(user)
    dbs.keymail = [
        { table: 'users', rows: [user], },
        { table: 'sessions', rows: sessions},
        { table: 'messages', rows: messages}
    ]
    const cryptobox = await dumpCryptobox(user.usernameHash)
    dbs[cryptobox.dbname] = cryptobox.tables
    return dbs
  }

  public dumpDB = () => {
    return this.db.dumpDB()
  }

  public restoreDumpedUser = (data: string) => {
    return this.db.restoreDumpedUser(data)
  }

  public selectOfflineNetwork = async (
    networkId: NETWORKS,
    shouldRefreshSessions = false,
    isFirstConnect = false,
    globalSettings?: IglobalSettings,
    err?: Error
  ) => {
    let usernameHash = getNetworkLastUsedUsernameHash(networkId)
    let currentNetworkSettings: InetworkSettings | undefined
    let currentNetworkUsers: Iuser[] = []
    let loadedUserData: IloadedUserData
    if (!usernameHash) {
      currentNetworkUsers = await this.db.getUsers(networkId)
      usernameHash = currentNetworkUsers.length > 0 ? currentNetworkUsers[0].usernameHash : ''
    }
    {[
      currentNetworkSettings,
      currentNetworkUsers,
      loadedUserData
    ] = await Promise.all([
      this.db.getNetworkSettings(networkId),

      currentNetworkUsers.length > 0
        ? Promise.resolve(currentNetworkUsers)
        : this.db.getUsers(networkId),

      this.db.getUser(networkId, usernameHash)
        .catch(() => this.currentUser)
        .then((_currentUser) => this.loadUserData(_currentUser))
    ])}

    const currentUser = loadedUserData[0]
    const sessions = currentUser && shouldRefreshSessions ? await this.db.getSessions(currentUser) : undefined

    runInAction(() => {
      if (isFirstConnect) {
        this.globalSettings = globalSettings as IglobalSettings
        this.offlineAvailableNetworks = getUsedNetworks()
        this.connectStatus = ERROR
        this.connectError = err as Error
        this.connectStatusDidChange(this.connectStatus, ERROR)
      }
      this.newMessageCount = 0
      this.currentNetworkSettings = currentNetworkSettings
      this.currentNetworkUsers = currentNetworkUsers
      this.offlineSelectedEthereumNetwork = networkId
      {[
        this.currentUser,
        , // [
            // this.indexedDBStore
            // this.box,
          // ]
        , // this.contacts,
        , // this.lastFetchBlock
      ] = loadedUserData}
      if (sessions) {
        this.currentUserSessions = sessions
      }
    })
  }

  public startFetchMessages = () => {
    if (this.connectStatus !== SUCCESS) {
      return
    }
    let deletedOutdatedPrekey = false
    const fetchNewMessagesLoop = async () => {
      if (this.connectStatus !== SUCCESS) {
        return
      }
      const web3 = getWeb3()
      const currentBlockNumber = await web3.eth.getBlockNumber().catch(() => undefined)
      if (typeof currentBlockNumber === 'undefined') {
        window.setTimeout(fetchNewMessagesLoop, FETCH_MESSAGES_INTERVAL)
        return
      }

      if (currentBlockNumber === this.currentUserlastFetchBlock) {
        window.setTimeout(fetchNewMessagesLoop, FETCH_MESSAGES_INTERVAL)
        return
      }

      try {
        await this.fetchNewMessages()

        if (!deletedOutdatedPrekey) {
          this.deleteOutdatedPrekeys()
          deletedOutdatedPrekey = true
        }
      } finally {
        window.setTimeout(fetchNewMessagesLoop, FETCH_MESSAGES_INTERVAL)
      }
    }
    runInAction(() => {
      this.isFetchingMessage = true
      this.fetchMessagesTimeout = window.setTimeout(fetchNewMessagesLoop, 0)
    })
  }

  public stopFetchMessages = () => {
    runInAction(() => {
      this.isFetchingMessage = false
      window.clearInterval(this.fetchMessagesTimeout)
    })
  }

  public loadSessions = async () => {
    if (!this.currentUser) {
      return
    }
    const {
      networkId,
      usernameHash
    } = this.currentUser
    const updatedUser = await this.db.getUser(networkId, usernameHash) as Iuser
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
    const messages = await this.db.getMessages(session.sessionTag)
    const newSession = await this.db.getSession(session.sessionTag, session.usernameHash) as Isession
    const unreadCount = newSession.unreadCount
    if (unreadCount > 0) {
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

  public listenForConnectStatusChange = (listener: TypeConnectStatusListener) => {
    this.connectStatusListener.push(listener)
    return () => {
      this.removeConnectStatusListener(listener)
    }
  }

  public removeConnectStatusListener = (listener: TypeConnectStatusListener) => {
    this.connectStatusListener = this.connectStatusListener.filter((_listener) => _listener !== listener)
  }

  public loadRegisteringUser = async () => {
    runInAction(() => {
      this.registeringUsers = this.currentNetworkUsers.filter((user) => user.status !== USER_STATUS.OK)
    })
  }

  public clearRegisteringUser = () => {
    runInAction(() => {
      this.registeringUsers = []
    })
  }

  public uploadPreKeys = async (
    user: Iuser,
    interval = 1, // 1 day
    numOfPreKeys = 100,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      preKeysDidUpload = noop,
      preKeysUploadDidFail = noop
    }: IuploadPreKeysLifecycle = {}
  ) => {
    const preKeys = generatePrekeys(unixToday(), interval, numOfPreKeys)
    const preKeysPublicKeys: IpreKeyPublicKeys = preKeys.reduce((result, preKey) => Object.assign(result, {
      [preKey.key_id]: `0x${preKey.key_pair.public_key.fingerprint()}`
    }), {})

    // use lastPreKey as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const preKeysPackage = new PreKeysPackage(preKeysPublicKeys, interval, lastPreKey.key_id)

    const uploadPreKeysTransactionHash = user.uploadPreKeysTransactionHash
    if (uploadPreKeysTransactionHash) {
      transactionDidCreate(uploadPreKeysTransactionHash)
      const web3 = getWeb3()
      const waitForTransactionReceipt = async (counter = 0) => {
        if (this.connectStatus !== SUCCESS) {
          return
        }
        const receipt = await web3.eth.getTransactionReceipt(uploadPreKeysTransactionHash)
          .catch(() => null)
        if (receipt !== null) {
          if (counter >= CONFIRMATION_NUMBER) {
            this.db.updateUserStatus(user, USER_STATUS.OK).catch(noop)
            runInAction(() => {
              if (this.currentUser && this.currentUser.usernameHash === user.usernameHash) {
                this.currentUser = Object.assign({}, this.currentUser, {status: USER_STATUS.OK})
                const index = this.currentNetworkUsers
                .findIndex((_user) => _user.usernameHash === (this.currentUser as Iuser).usernameHash)
                if (index !== -1) {
                  this.currentNetworkUsers[index] = this.currentUser
                  this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
                }
              }
            })
            return preKeysDidUpload()
          } else {
            window.setTimeout(waitForTransactionReceipt, 1000, counter + 1)
            return
          }
        }

        if (counter === 50) {
          return preKeysUploadDidFail(new Error('Timeout'))
        }

        window.setTimeout(waitForTransactionReceipt, 1000, counter)
      }

      return waitForTransactionReceipt()
    }

    transactionWillCreate()
    await this.preKeysContract.upload(
      user.username,
      `0x${sodium.to_hex(new Uint8Array(preKeysPackage.serialise()))}`
    ).on('transactionHash', async (transactionHash) => {
      transactionDidCreate(transactionHash)
      if (!this.indexedDBStore || !this.box) {
        return
      }
      const store = this.indexedDBStore
      // enhancement: remove all local prekeys before save
      await store.save_prekeys(preKeys.concat(lastResortPrekey))
      await this.box.load()
      await this.db.updateUserAddUploadPreKeysTxHash(user, transactionHash).catch(preKeysUploadDidFail)
      runInAction(() => {
        if (this.currentUser && this.currentUser.usernameHash === user.usernameHash) {
          this.currentUser = Object.assign({}, this.currentUser, {uploadPreKeysTransactionHash: transactionHash})
          const index = this.currentNetworkUsers
            .findIndex((_user) => _user.usernameHash === (this.currentUser as Iuser).usernameHash)
          if (index !== -1) {
            this.currentNetworkUsers[index] = this.currentUser
            this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
          }
        }
      })
    })
      .on('error', preKeysUploadDidFail)
    this.db.updateUserStatus(user, USER_STATUS.OK).catch(noop)
    runInAction(() => {
      if (this.currentUser && this.currentUser.usernameHash === user.usernameHash) {
        this.currentUser = Object.assign({}, this.currentUser, {status: USER_STATUS.OK})
        const index = this.currentNetworkUsers
          .findIndex((_user) => _user.usernameHash === (this.currentUser as Iuser).usernameHash)
        if (index !== -1) {
          this.currentNetworkUsers[index] = this.currentUser
          this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
        }
      }
    })
    preKeysDidUpload()
  }

  private connectStatusDidChange(prevStatus: TRUSTBASE_CONNECT_STATUS, currentStatus: TRUSTBASE_CONNECT_STATUS) {
    this.connectStatusListener.forEach((listener) => {
      listener(prevStatus, currentStatus)
    })
  }

  private listenForEthereumAccountChange = async () => {
    const web3 = getWeb3()
    const accounts = await web3.eth.getAccounts().catch(() => [] as string[])
    if (accounts.length > 0) {
      if (this.currentEthereumAccount !== accounts[0]) {
        runInAction(() => {
          this.currentEthereumAccount = web3.eth.defaultAccount = accounts[0]
          const prevConnectStatus = this.connectStatus
          this.connectStatus = this.connectError ? CONTRACT_ADDRESS_ERROR : SUCCESS
          this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
        })
      }
    } else if (this.connectStatus !== NO_ACCOUNT) {
      runInAction(() => {
        this.currentEthereumAccount = ''
        this.offlineAvailableNetworks = getUsedNetworks()
        const prevConnectStatus = this.connectStatus
        this.connectStatus = NO_ACCOUNT
        this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
      })
    }
    this.detectAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 10000)
  }

  private listenForNetworkChange = async () => {
    const web3 = getWeb3()
    const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch(() => undefined)

    if (this.currentEthereumNetwork !== currentNetworkId) {
      window.clearTimeout(this.detectAccountChangeTimeout)
      if (typeof currentNetworkId === 'undefined') {
        runInAction(() => {
          this.currentEthereumNetwork = undefined
          this.offlineSelectedEthereumNetwork = currentNetworkId
          this.offlineAvailableNetworks = getUsedNetworks()
          const prevConnectStatus = this.connectStatus
          this.connectStatus = OFFLINE
          this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
        })
      } else {
        return this.processAfterNetworkConnected()
      }
    }
    window.setTimeout(this.listenForNetworkChange, 10000)
  }

  private processAfterNetworkConnected = async (
    isFirstConnect = false,
    globalSettings?: IglobalSettings
  ) => {
    const web3 = getWeb3()
    const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch(() => undefined)
    if (typeof currentNetworkId === 'undefined') {
      return
    }
    const usernameHash: string = getNetworkLastUsedUsernameHash(currentNetworkId)
    const loadedResult = await Promise.all([
      // currentNetworkSettings
      this.db.getNetworkSettings(currentNetworkId),
      // currentNetworkUsers
      this.db.getUsers(currentNetworkId),
      // *userData
      this.db.getUser(currentNetworkId, usernameHash)
        .catch(() => this.currentUser)
        .then((currentUser) => this.loadUserData(currentUser))
    ])

    runInAction(() => {
      if (isFirstConnect) {
        this.globalSettings = globalSettings as IglobalSettings
      }
      {[
        this.currentNetworkSettings,
        this.currentNetworkUsers,
        [
          this.currentUser,
          [
            this.indexedDBStore,
            this.box,
          ],
          this.currentUserContacts,
          this.currentUserlastFetchBlock
        ]
      ] = loadedResult}
      this.newMessageCount = 0

      if (this.currentUser) {
        addUsedNetwork(currentNetworkId)
        setLastUsedUser(currentNetworkId, this.currentUser.usernameHash)
      }

      this.currentEthereumAccount = web3.eth.defaultAccount
      this.currentEthereumNetwork = currentNetworkId
      try {
        const {
          IdentitiesAddress,
          PreKeysAddress,
          MessagesAddress
        } = this.currentNetworkSettings

        this.identitiesContract = new Identities(Object.assign({
          address: IdentitiesAddress,
          currentNetworkId
        }))

        this.preKeysContract = new PreKeys(Object.assign({
          address: PreKeysAddress,
          currentNetworkId
        }))

        this.messagesContract = new Messages(Object.assign({
          address: MessagesAddress,
          currentNetworkId
        }))

        const prevConnectStatus = this.connectStatus
        this.connectStatus = SUCCESS
        this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
      } catch (err) {
        // have trouble with contract instantiation.
        const prevConnectStatus = this.connectStatus
        this.connectStatus = CONTRACT_ADDRESS_ERROR
        this.connectError = err
        this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
      }
      this.detectAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
      window.setTimeout(this.listenForNetworkChange, 100)
    })
  }

  private loadUserData = (
    currentUser: Iuser | undefined
  ) => Promise.all([
    // currentUser
    currentUser
      ? this.db.getUser(currentUser.networkId, currentUser.usernameHash).catch(() => currentUser)
      : currentUser,
    // box
    (async () => {
      if (!currentUser) {
        return Promise.reject(null)
      }
      const store = new IndexedDBStore(currentUser.usernameHash)
      /**
       * Looks like cryptobox constructure function has a wrong signature...
       * Dont forget to set the second argument to 0 to disable cryptobox's
       * pre-keys auto-refill
       */
      const box = new Cryptobox(store as any, 0)
      await box.load()
      return [store, box] as [IndexedDBStore, Cryptobox]
    })()
      .catch(() => {
        return [undefined, undefined] as [IndexedDBStore | undefined, Cryptobox | undefined]
      }),
    // contacts
    Promise.resolve(currentUser ? currentUser.contacts : []),
    // lastFetchBlock
    Promise.resolve(currentUser ? currentUser.lastFetchBlock : 0)
    ])

  private getPreKeys = async (usernameOrUsernameHash: string, isHash: boolean = false) => {
    const preKeysPackageSerializedStr = await this.preKeysContract.getPreKeys(
      usernameOrUsernameHash,
      { isHash }
    )

    if (preKeysPackageSerializedStr === '') {
      return new PreKeysPackage({}, 0, 0)
    }

    return PreKeysPackage.deserialize(sodium.from_hex(preKeysPackageSerializedStr.slice(2)).buffer)
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
      await this.db.updateLastFetchBlock(user, lastBlock).then(noop)
      runInAction(() => {
        this.currentUserlastFetchBlock = lastBlock
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
              user,
              contact: {
                blockHash: message.blockHash as string,
                username: message.fromUsername as string,
                usernameHash: getUsernameHash(message.fromUsername as string)
              },
              summary: `${plainText.slice(0, SUMMARY_LENGTH)}${plainText.length > SUMMARY_LENGTH ? '...' : ''}`,
              status: MESSAGE_STATUS.DELIVERED,
            }))
          default:
            const sessionTag = message.sessionTag
            if (this.currentSession && this.currentSession.sessionTag === sessionTag) {
              return this.db.createMessage(Object.assign({}, message, {
                  user,
                  plainText: message.plainText as string,
                  shouldAddUnread: false,
                  transactionHash: '',
                  status: MESSAGE_STATUS.DELIVERED,
                }))
                  .then(() => this.db.getMessages(sessionTag))
                  .then(async (_messages) => {
                    const sessionInDB = await this.db.getSession(sessionTag, user.usernameHash).catch(() => undefined)
                    runInAction(() => {
                      if (this.currentSession && this.currentSession.sessionTag === sessionTag) {
                        this.currentSessionMessages = _messages
                        const index = this.currentUserSessions
                          .findIndex((session) => session.sessionTag === sessionTag)
                        if (sessionInDB !== undefined) {
                          this.currentSession = sessionInDB
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
                user,
                plainText: message.plainText as string,
                transactionHash: '',
                status: MESSAGE_STATUS.DELIVERED,
              }))
            }
        }
      }).concat(
        this.db.updateLastFetchBlock(user, lastBlock).then(noop)
      )
    ).then(() => {
      runInAction(() => {
        this.currentUserlastFetchBlock = lastBlock
        if (unreadMessagesLength > 0) {
          this.newMessageCount += unreadMessagesLength
        }
      })
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
          box.session_delete(sessionTag).then(noop),
          this.db.getSession(sessionTag, (this.currentUser as Iuser).usernameHash).then((session) => {
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
        sessionTag
      }))
  }

  private deserializeMessage = async ({
    decryptedPaddedMessage,
    senderIdentity,
    timestamp,
    messageByteLength
  }: IdecryptedTrustbaseMessage) => {
    const unpaddedMessage = unpad512BytesMessage(decryptedPaddedMessage, messageByteLength)
    const {
      subject,
      messageType,
      fromUsername,
      plainText
    } = JSON.parse(unpaddedMessage) as IrawUnppaddedMessage

    let blockHash
    if (fromUsername) {
      const {
        blockNumber,
        publicKey: expectedFingerprint
      } = await this.identitiesContract.getIdentity(fromUsername)

      const web3 = getWeb3()
      blockHash = await web3.eth.getBlock(blockNumber)
        .then((block) => block.hash).catch(() => '0x0')

      if (expectedFingerprint !== `0x${senderIdentity.fingerprint()}`) {
        throw new Error('Invalid message: sender identity not match')
      }

      if (messageType === MESSAGE_TYPE.HELLO && this.box && this.indexedDBStore) {
        this.box = new Cryptobox(this.indexedDBStore as any, 0)
        this.box.load()
      }
    }

    return {
      messageType,
      subject,
      timestamp: Number(timestamp),
      fromUsername,
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

function generatePrekeys(start: number, interval: number, size: number) {
  if (size === 0) {
    return []
  }

  return [...Array(size).keys()]
    .map((x) => PreKey.new(((start + (x * interval)) % PreKey.MAX_PREKEY_ID)))
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

  const publicKey = publicKeyFromHexStr(preKeyPublicKeyString.slice(2))
  return {
    id: preKeyID,
    publicKey
  }
}

function unixToday() {
  return getUnixDay(Date.now())
}

function getUnixDay(javaScriptTimestamp: number) {
  return Math.floor(javaScriptTimestamp / 1000 / 3600 / 24)
}

function publicKeyFromHexStr(publicKeyHexString: string) {
  const preKeyPublicKeyEd = sodium.from_hex(publicKeyHexString)
  const preKeyPublicKeyCurve = ed2curve.convertPublicKey(preKeyPublicKeyEd)
  return keys.PublicKey.new(
    preKeyPublicKeyEd,
    preKeyPublicKeyCurve
  )
}

function identityKeyFromHexStr(identityKeyHexString: string) {
  const bobIdentityKeyEd = sodium.from_hex(identityKeyHexString)
  const bobIdentityKeyCurve = ed2curve.convertPublicKey(bobIdentityKeyEd)
  return keys.IdentityKey.new(keys.PublicKey.new(
    bobIdentityKeyEd,
    bobIdentityKeyCurve
  ))
}

function padTo512Bytes(plaintext: string) {
  const typeArrayText = sodium.from_string(plaintext)
  const messageByteLength: number = typeArrayText.byteLength
  if (messageByteLength >= 512) {
    throw new RangeError('Message to large')
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

function setLastUsedUser(networkId: NETWORKS, usernameHash: string) {
  localStorage.setItem(
    LOCAL_STORAGE_KEYS.LAST_USED_USER,
    JSON.stringify({networkId, usernameHash})
  )
  setNetworkLastUsedUsernameHash(networkId, usernameHash)
}

function getLastUsedUser(): {
  networkId?: NETWORKS,
  usernamHash?: string
} {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_USED_USER) || '{}')
  } catch (err) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.USED_NETWORKS, '{}')
    return {}
  }
}

function setNetworkLastUsedUsernameHash(networkId: NETWORKS, usernameHash: string) {
  localStorage.setItem(
    `${LOCAL_STORAGE_KEYS
      .NETWORK_LAST_USED_USERNAME_HASH[0]}${networkId}${LOCAL_STORAGE_KEYS
        .NETWORK_LAST_USED_USERNAME_HASH[1]}`,
    usernameHash
  )
}

function getNetworkLastUsedUsernameHash(networkId: NETWORKS) {
  return (localStorage.getItem(
    `${LOCAL_STORAGE_KEYS
      .NETWORK_LAST_USED_USERNAME_HASH[0]}${networkId}${LOCAL_STORAGE_KEYS
        .NETWORK_LAST_USED_USERNAME_HASH[1]}`)
    || ''
  ).toString()
}

function addUsedNetwork(networkId: NETWORKS) {
  const usedNetworks = getUsedNetworks()
  if (!usedNetworks.includes(networkId)) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.USED_NETWORKS, JSON.stringify(usedNetworks.concat(networkId)))
  }
}

function getUsedNetworks(): NETWORKS[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USED_NETWORKS) || '[]')
  } catch (err) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.USED_NETWORKS, '[]')
    return []
  }
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
