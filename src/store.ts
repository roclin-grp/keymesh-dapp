import {
  observable,
  computed,
  runInAction,
  useStrict
} from 'mobx'

import {
  initialize,
  getWeb3,
  Identities,
  Messages,
  TrustbaseError,
  BroadcastMessages,
  BoundSocials,
} from 'trustbase'

import { keys, message as proteusMessage } from 'wire-webapp-proteus'
import { Cryptobox, CryptoboxSession } from 'wire-webapp-cryptobox'

const sodium = require('libsodium-wrappers-sumo')

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
  IsignedBroadcastMessage,
  IreceviedBroadcastMessage,
} from '../typings/interface.d'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  SENDING_FAIL_CODE,
  NETWORKS,
  MESSAGE_TYPE,
  LOCAL_STORAGE_KEYS,
  FETCH_MESSAGES_INTERVAL,
  FETCH_BROADCAST_MESSAGES_INTERVAL,
  PRE_KEY_ID_BYTES_LENGTH,
  SUMMARY_LENGTH,
  USER_STATUS,
  MESSAGE_STATUS,
  FETCH_BOUND_EVENTS_INTERVAL,
  SOCIAL_MEDIA_PLATFORMS,
  BINDING_SOCIAL_STATUS,
} from './constants'

import {
  utf8ToHex,
  hexToUtf8,
  noop,
  storeLogger,
  dumpCryptobox,
  unixToday,
} from './utils'

import {
  publicKeyFromHexStr
} from './crypto.utils'

import {
  IboundSocials,
  IsignedBoundSocials,
  IbindingSocial,
  IbindingSocials,
} from '../typings/proof.interface'
import { TwitterResource } from './resources/twitter'

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

useStrict(true)

const SESSION_PRE_PAGE = 25

type IloadedUserData = [
  Iuser | undefined,
  [
    IndexedDBStore | undefined,
    Cryptobox | undefined
  ],
  Icontact[],
  web3BlockType,
  web3BlockType,
  web3BlockType
]

type TypeConnectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => void

export class Store {
  @observable public connectStatus: TRUSTBASE_CONNECT_STATUS = PENDING
  @observable public lastConnectStatus: TRUSTBASE_CONNECT_STATUS = PENDING
  @observable public connectError: Error | undefined
  @observable.ref public globalSettings: IglobalSettings = {}
  @observable public currentEthereumNetwork: NETWORKS | undefined
  @observable public currentEthereumAccount = ''
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
  @observable.ref public broadcastMessages: IreceviedBroadcastMessage[] = []
  @observable public isFetchingMessage = false
  @observable public isFetchingBroadcast = false
  @observable public isFetchingBoundEvents = false

  @observable.ref public currentUserBoundSocials: IboundSocials = {}
  @observable public currentUserBindingSocials: IbindingSocials = {}
  public constructor() {
    this.db = new DB()
  }

  private connectStatusListener: TypeConnectStatusListener[] = []
  private currentUserlastFetchBlock: web3BlockType = 0
  private currentUserlastFetchBlockOfBroadcast: web3BlockType = 0
  private currentUserlastFetchBlockOfBoundSocials: web3BlockType = 0
  private indexedDBStore: IndexedDBStore | undefined
  private box: Cryptobox | undefined
  private identitiesContract: Identities
  private messagesContract: Messages
  private broadcastMessagesContract: BroadcastMessages
  private boundSocialsContract: BoundSocials
  private detectAccountChangeTimeout: number
  private detectNetworkChangeTimeout: number
  private fetchMessagesTimeout: number
  private fetchBroadcastMessagesTimeout: number
  private fetchBoundEventsTimeout: number
  private db: DB
  private broadcastMessagesSignatures: string[]
  private _twitterResource: TwitterResource|undefined

  public get twitterResource(): TwitterResource|undefined {
    if (typeof this._twitterResource === 'undefined') {
      const consumerKey = process.env.REACT_APP_TWITTER_CONSUMER_KEY
      const secretKey = process.env.REACT_APP_TWITTER_SECRET_KEY
      if (typeof consumerKey === 'undefined' || typeof secretKey === 'undefined') {
        storeLogger.error('REACT_APP_TWITTER_CONSUMER_KEY or REACT_APP_TWITTER_SECRET_KEY must be set.')
        return undefined
      }

      this._twitterResource = new TwitterResource(consumerKey, secretKey)
    }

    return this._twitterResource
  }

  @computed
  public get pageLength() {
    return Math.ceil(this.currentUserSessions.length / SESSION_PRE_PAGE)
  }

  @computed get offlineAvailableNetworks(): NETWORKS[] {
    const {
      connectStatus
    } = this
    if (
      connectStatus === TRUSTBASE_CONNECT_STATUS.ERROR
      || connectStatus === TRUSTBASE_CONNECT_STATUS.OFFLINE
    ) {
      return getUsedNetworks()
    }
    return []
  }

  @computed
  public get canCreateOrImportUser() {
    const {
      canConnectToIdentitesContract,
      currentNetworkUsers,
      currentEthereumAccount
    } = this
    return canConnectToIdentitesContract
      && (currentNetworkUsers.findIndex((user) => user.userAddress === currentEthereumAccount) === -1)
  }

  @computed
  public get canConnectToIdentitesContract() {
    const {
      connectStatus,
      connectError
    } = this
    const isConnected = connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS
    const hasContractErrorButNotIdentities = connectStatus === TRUSTBASE_CONNECT_STATUS.CONTRACT_ADDRESS_ERROR
      && !!connectError
      && !connectError.message.includes('Identities')
    return isConnected || hasContractErrorButNotIdentities
  }

  public connect = async () => {
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

    this.broadcastMessagesSignatures = []

    return initialize({
      provider
    })
      .then(() => this.processAfterNetworkConnected(globalSettings))
      .catch(async (err: Error) => {
        /**
         * Offline mode
         */
        if ((err as TrustbaseError).code === TrustbaseError.CODE.FOUND_NO_ACCOUNT) {
          /**
           * We did have connected to a network and instantiated web3 but
           * found no account. Just wait for a available account.
           */
          const web3 = getWeb3()
          const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch((_err) => {
            storeLogger.error(_err)
            return undefined
          })
          let loadedResult: [InetworkSettings, Iuser[], IloadedUserData]
          if (typeof currentNetworkId !== 'undefined') {
            const userAddress: string = getNetworkLastUsedUserAddress(currentNetworkId)
            loadedResult = await Promise.all([
              // currentNetworkSettings
              this.db.getNetworkSettings(currentNetworkId).catch((_err: Error) => {
                storeLogger.error(_err)
                return {networkId: currentNetworkId}
              }),
              // currentNetworkUsers
              this.db.getUsers(currentNetworkId).catch((_err: Error) => {
                storeLogger.error(_err)
                return []
              }),
              // *userData
              this.db.getUser(currentNetworkId, userAddress)
                .catch((_err: Error) => {
                  storeLogger.error(_err)
                  return undefined
                })
                .then((currentUser) => this.loadUserData(currentUser))
            ])
          }

          runInAction(() => {
            this.globalSettings = globalSettings
            if (typeof currentNetworkId !== 'undefined') {
              this.currentEthereumNetwork = currentNetworkId
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
                  this.currentUserlastFetchBlock,
                  this.currentUserlastFetchBlockOfBroadcast,
                  this.currentUserlastFetchBlockOfBoundSocials,
                ]
              ] = loadedResult}
              if (typeof this.currentUser !== 'undefined') {
                this.currentUserBoundSocials = this.currentUser.boundSocials
                this.currentUserBindingSocials = this.currentUser.bindingSocials
              }
            }
            const prevConnectStatus = this.connectStatus
            this.connectStatus = NO_ACCOUNT
            this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
          })

          const waitForAccount = async () => {
            const accounts: string[] = await web3.eth.getAccounts().catch((_err: Error) => {
              storeLogger.error(_err)
              return []
            })
            if (accounts.length > 0) {
              return this.processAfterNetworkConnected().catch((_err: Error) => {
                storeLogger.error(_err)
                this.processError(_err, globalSettings)
              })
            }
            return window.setTimeout(waitForAccount, 100)
          }
          window.setTimeout(waitForAccount, 100)
        } else {
          /**
           * In this case, we can't instantiate web3, user need to refresh the
           * page to retry.
           */
          this.processError(err, globalSettings)
        }
      })
  }

  public startFetchBoundEvents = () => {
    if (this.connectStatus !== SUCCESS || this.isFetchingBoundEvents) {
      return
    }
    const fetchLoop = async () => {
      try {
        await this.fetchBoundEvents()
      } finally {
        runInAction(() => {
          this.fetchBoundEventsTimeout = window.setTimeout(fetchLoop, FETCH_BOUND_EVENTS_INTERVAL)
        })
      }
    }

    runInAction(() => {
      this.isFetchingBoundEvents = true
      this.fetchBoundEventsTimeout = window.setTimeout(fetchLoop, 0)
    })
  }

  public addBindingSocial = async (
    platform: SOCIAL_MEDIA_PLATFORMS,
    bindingSocial: IbindingSocial,
  ) => {
    if (typeof this.currentUser === 'undefined') {
      return
    }

    const bindingSocials: IbindingSocials = Object.assign({}, this.currentUser.bindingSocials)
    switch (platform) {
      case SOCIAL_MEDIA_PLATFORMS.GITHUB:
        bindingSocials.github = bindingSocial
        break
      case SOCIAL_MEDIA_PLATFORMS.TWITTER:
        bindingSocials.twitter = bindingSocial
        break
      default:
        return
    }

    this.updateBindingSocials(bindingSocials, this.currentUser)
  }

  public uploadBindingSocials = async (
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      sendingDidComplete = noop,
      sendingDidFail = noop
    }: IsendingLifecycle = {},
  ) => {
    if (typeof this.currentUser === 'undefined') {
      // todo: deal with empty user
      return
    }

    const newBoundSocials: IboundSocials = Object.assign({}, this.currentUserBoundSocials)
    if (typeof this.currentUserBindingSocials.github !== 'undefined') {
      const _bindingSocial = this.currentUserBindingSocials.github
      newBoundSocials.github = {username: _bindingSocial.username, proofURL: _bindingSocial.proofURL}
    }

    if (typeof this.currentUserBindingSocials.twitter !== 'undefined') {
      const _bindingSocial = this.currentUserBindingSocials.twitter
      newBoundSocials.twitter = {username: _bindingSocial.username, proofURL: _bindingSocial.proofURL}
    }

    const signature = '0x' + this.currentUserSign(JSON.stringify(newBoundSocials))
    const signedBoundSocials: IsignedBoundSocials = {signature, socialMedias: newBoundSocials}
    const signedBoundSocialsHex = utf8ToHex(JSON.stringify(signedBoundSocials))

    transactionWillCreate()
    this.boundSocialsContract.bind(this.currentUser.userAddress, signedBoundSocialsHex)
      .on('transactionHash', (hash) => {
        transactionDidCreate(hash)
        runInAction(() => {
          if (typeof this.currentUserBindingSocials.github !== 'undefined') {
            this.currentUserBindingSocials.github.status = BINDING_SOCIAL_STATUS.TRANSACTION_CREATED
          }
          if (typeof this.currentUserBindingSocials.twitter !== 'undefined') {
            this.currentUserBindingSocials.twitter.status = BINDING_SOCIAL_STATUS.TRANSACTION_CREATED
          }
        })
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          if (!receipt.events) {
            sendingDidFail(new Error('Unknown error'))
            return
          }
          const _bindingSocials = Object.assign({}, this.currentUserBindingSocials)
          if (typeof _bindingSocials.github !== 'undefined') {
            _bindingSocials.github = undefined
          }
          if (typeof _bindingSocials.twitter !== 'undefined') {
            _bindingSocials.twitter = undefined
          }
          if (typeof this.currentUser !== 'undefined') {
            runInAction(() => {
              this.currentUserBoundSocials = Object.assign({}, newBoundSocials)
              storeLogger.info(JSON.stringify(this.currentUserBoundSocials))
            })
            await this.updateBindingSocials(_bindingSocials, this.currentUser)
          }

          sendingDidComplete()
        }
      })
      .on('error', (error: Error) => {
        sendingDidFail(error)
      })
  }

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

  public register = async ({
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    userDidCreate = noop,
    registerDidFail = noop
  }: IregisterLifecycle = {}) => new Promise(async (resolve, reject) => {
    const userAddress = this.currentEthereumAccount
    const currentNetworkId = this.currentEthereumNetwork

    // unexpected error
    if (!currentNetworkId) {
      throw new Error('Ethereum Network not found!')
    }
    if (!userAddress) {
      throw new Error('Ethereum Account not found!')
    }

    // check if registered, avoid unnecessary transaction
    const {
      publicKey: identityFingerprint
    } = await this.identitiesContract.getIdentity(userAddress)
    if (Number(identityFingerprint) !== 0) {
      return registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
    }

    const identityKeyPair = IdentityKeyPair.new()
    const newIdentityFingerprint = `0x${identityKeyPair.public_key.fingerprint()}`

    transactionWillCreate()
    this.identitiesContract.register(newIdentityFingerprint)
      .on('transactionHash', async (transactionHash) => {
        transactionDidCreate(transactionHash)
        const store = new IndexedDBStore(`${currentNetworkId}@${userAddress}`)
        await store.save_identity(identityKeyPair).catch(reject)
        const lastResortPrekey = PreKey.last_resort()
        await store.save_prekeys([lastResortPrekey]).catch(reject)
        this.db.createUser(
          {
            networkId: currentNetworkId,
            userAddress
          },
          {
            identityTransactionHash: transactionHash,
            identity: sodium.to_hex(new Uint8Array(identityKeyPair.serialise()))
          }
        )
          .then(async () => {
            const createdUser = await this.db.getUser(currentNetworkId, userAddress).catch(reject)
            if (createdUser) {
              this.useUser(createdUser).then(userDidCreate)
              runInAction(() => {
                this.currentNetworkUsers = this.currentNetworkUsers.concat(createdUser)
              })
              return resolve()
            }
          })
          .catch(reject)
      })
      .on('error', async (err) => {
        storeLogger.error(err)
        // TODO: delete user
        // const createdUser = await this.db.getUser(currentNetworkId, userAddress).catch(() => undefined)
        // if (createdUser) {
        //   this.db.deleteUser(createdUser)
        // }
        reject(err)
      })
  }).catch(registerDidFail)

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
      if (this.connectStatus !== SUCCESS) {
        return
      }
      const receipt = await web3.eth.getTransactionReceipt(txHash)
        .catch(() => null)
      if (receipt !== null) {
        if (counter >= Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          this.db.updateMessageStatus(message, MESSAGE_STATUS.DELIVERED)
            .then(async () => {
              if (this.currentSession !== undefined && message.sessionTag === this.currentSession.sessionTag) {
                const _messages = await this.db.getMessages(message.sessionTag, message.userAddress).catch(() => [])
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

  public checkRegister = async (
    user: Iuser,
    {
      checkRegisterWillStart = noop,
      identityDidUpload = noop,
      registerDidFail = noop,
    }: IcheckRegisterLifecycle = {}
  ) => {
    if (user.status === USER_STATUS.IDENTITY_UPLOADED) {
      return identityDidUpload()
    }

    if (!user.registerRecord) {
      throw new Error('Register record not found')
    }

    const {
      userAddress,
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
      const receipt = await web3.eth.getTransactionReceipt(identityTransactionHash).catch((err: Error) => {
        storeLogger.error(err)
        return null
      })
      if (receipt) {
        if (counter >= Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          const {
            blockNumber,
            publicKey: registeredIdentityFingerprint
          } = await this.identitiesContract.getIdentity(userAddress)
            .catch((err: Error) => {
              storeLogger.error(err)
              return {publicKey: '', blockNumber: 0}
            })
          // we have receipt but found no identity, retry
          if (!registeredIdentityFingerprint || Number(registeredIdentityFingerprint) === 0) {
            return window.setTimeout(waitForTransactionReceipt, 1000, counter)
          }

          if (registeredIdentityFingerprint === `0x${identityKeyPair.public_key.fingerprint()}`) {
            const blockHash = await this.getBlockHash(blockNumber)
            if (Number(blockHash) === 0) {
              return window.setTimeout(waitForTransactionReceipt, 1000, counter)
            }
            user.blockHash = blockHash
            try {
              await this.db.updateUserStatus(user, USER_STATUS.IDENTITY_UPLOADED)
              runInAction(() => {
                if (this.currentUser && this.currentUser.userAddress === user.userAddress) {
                  this.currentUser = Object.assign({}, this.currentUser, {
                    status: USER_STATUS.IDENTITY_UPLOADED,
                    blockHash
                  })
                  const index = this.currentNetworkUsers
                    .findIndex((_user) => _user.userAddress === (this.currentUser as Iuser).userAddress)
                  if (index !== -1) {
                    this.currentNetworkUsers[index] = this.currentUser
                    this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
                  }
                }
              })
              return identityDidUpload()
            } catch (err) {
              registerDidFail(err)
            }
          } else {
            // TODO: delete user
            // this.db.deleteUser(user).catch((err: Error) => {
            //   storeLogger.error(err)
            // })
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
      case this.connectStatus !== SUCCESS:
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
      .catch((err) => {
        sendingDidFail(err)
        return {publicKey: undefined, blockNumber: 0}
      })

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
    } = await this.getPreKeys(toUserAddress).catch((err) => {
      storeLogger.error(err)
      return new PreKeysPackage({}, 0, 0)
    })
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

          const messages = await this.db.getMessages(usingSessionTag, currentUser.userAddress).catch(() => undefined)
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

            const messages = await this.db.getMessages(usingSessionTag, currentUser.userAddress).catch(() => undefined)
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
    const networkId = this.currentEthereumNetwork || this.offlineSelectedEthereumNetwork
    if (!networkId) {
      return
    }
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
        this.currentUserlastFetchBlock,
        this.currentUserlastFetchBlockOfBoundSocials,
        this.currentUserlastFetchBlockOfBroadcast,
      ] = userData
      if (sessions) {
        this.currentSession = undefined
        this.currentUserSessions = sessions
      }
      this.newMessageCount = 0
      addUsedNetwork(networkId)
      setLastUsedUser(networkId, user.userAddress)
      if (typeof this.currentUser !== 'undefined') {
        this.currentUserBoundSocials = this.currentUser.boundSocials
        this.currentUserBindingSocials = this.currentUser.bindingSocials
      }
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
    const cryptobox = await dumpCryptobox(user)
    dbs[cryptobox.dbname] = cryptobox.tables
    return dbs
  }

  public dumpDB = () => {
    return this.db.dumpDB()
  }

  public restoreDumpedUser = async (data: string, shouldRefreshSessions: boolean) => {
    await this.db.restoreDumpedUser(data)
    const currentNetworkId = this.currentEthereumNetwork
    if (currentNetworkId) {
      const oldUsers = this.currentNetworkUsers
      const users = await this.db.getUsers(currentNetworkId)
      if (users.length > 0) {
        runInAction(() => {
          this.currentNetworkUsers = users
        })
        if (oldUsers.length > 0) {
          const userAddresses = oldUsers.reduce(
            (result, user) => {
              result[user.userAddress] = true
              return result
            },
            {} as {[userAddress: string]: boolean}
          )
          const newUser = users.find((user) => !userAddresses[user.userAddress])
          if (newUser && newUser.networkId === currentNetworkId) {
            await this.useUser(newUser, shouldRefreshSessions)
            if (shouldRefreshSessions) {
              return this.startFetchMessages()
            }
          }
        } else {
          const newUser = users[0]
          if (newUser.networkId === currentNetworkId) {
            await this.useUser(newUser, shouldRefreshSessions)
            if (shouldRefreshSessions) {
              return this.startFetchMessages()
            }
          }
        }
      }
    }
  }

  public selectOfflineNetwork = async (
    networkId: NETWORKS,
    shouldRefreshSessions = false,
    isFirstConnect = false,
    globalSettings = this.globalSettings,
    err?: Error
  ) => {
    const [
      currentNetworkSettings,
      currentNetworkUsers,
      loadedUserData
    ] = await this.loadNetworkData(networkId)

    const currentUser = loadedUserData[0]
    const sessions = currentUser && shouldRefreshSessions ? await this.db.getSessions(currentUser) : undefined

    runInAction(() => {
      if (isFirstConnect) {
        this.connectStatus = ERROR
        this.connectError = err as Error
        this.connectStatusDidChange(this.connectStatus, ERROR)
      }
      this.globalSettings = globalSettings as IglobalSettings
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
      if (this.currentUser) {
        addUsedNetwork(networkId)
        setLastUsedUser(networkId, this.currentUser.userAddress)
        this.currentUserBoundSocials = this.currentUser.boundSocials
        this.currentUserBindingSocials = this.currentUser.bindingSocials
      }
      if (sessions) {
        this.currentSession = undefined
        this.currentUserSessions = sessions
      }
    })
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
    //
    const user = this.currentUser
    if (typeof user === 'undefined' || user.status !== USER_STATUS.OK) {
      //      todo: deal with undeifned
      return
    }

    if (typeof this.box === 'undefined') {
      //      todo: deal with undeifned
      return
    }

    const signature = sodium.to_hex(this.box.identity.secret_key.sign(message))
    const timestamp = Math.floor(Date.now() / 1000)
    const signedMessage: IsignedBroadcastMessage = {
        message,
        signature,
        timestamp,
    }
    const signedMessageHex = utf8ToHex(JSON.stringify(signedMessage))
    this.broadcastMessagesContract.publish(signedMessageHex, user.userAddress)
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
    if (this.connectStatus !== SUCCESS || this.isFetchingBroadcast) {
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
    if (this.connectStatus !== SUCCESS) {
      return
    }
    let isOutdatedPrekeysDeleted = false

    const fetchNewMessagesLoop = async () => {
      if (this.connectStatus !== SUCCESS || !this.isFetchingMessage) {
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

  public stopFetchBoundEvents = () => {
    runInAction(() => {
      this.isFetchingBoundEvents = false
      window.clearTimeout(this.fetchBoundEventsTimeout)
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

  public currentUserSign = (message: string) => {
    if (typeof this.box === 'undefined') {
      return ''
    }
    return sodium.to_hex(this.box.identity.secret_key.sign(message))
  }

  public uploadPreKeys = async (
    user: Iuser,
    interval = 1, // 1 day
    numOfPreKeys = 100,
    {
      preKeysDidUpload = noop,
      preKeysUploadDidFail = noop
    }: IuploadPreKeysLifecycle = {}
  ) => {
    if (typeof this.box === 'undefined') {
      preKeysUploadDidFail(new Error('this.box is undefined'))
      return
    }
    const preKeys = generatePrekeys(unixToday(), interval, numOfPreKeys)

    const preKeysPublicKeys: IpreKeyPublicKeys = preKeys.reduce(
      (result, preKey) => Object.assign(result, {
        [preKey.key_id]: `0x${preKey.key_pair.public_key.fingerprint()}`
      }),
      {}
    )

    // use lastPreKey as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const preKeysPackage = new PreKeysPackage(preKeysPublicKeys, interval, lastPreKey.key_id)

    const uploadPreKeysUrl = process.env.REACT_APP_KVASS_ENDPOINT + user.userAddress
    const hexedPrekeys = `0x${sodium.to_hex(new Uint8Array(preKeysPackage.serialise()))}`
    const prekeysSignature = this.currentUserSign(hexedPrekeys)
    const init = {
      method: 'PUT',
      mode: 'cors',
      body: hexedPrekeys + ' ' + prekeysSignature,
    } as RequestInit

    const resp = await fetch(uploadPreKeysUrl, init)
    if (resp.status === 201) {
      if (!this.indexedDBStore || !this.box) {
        return
      }

      const store = this.indexedDBStore
      // enhancement: remove all local prekeys before save
      await store.save_prekeys(preKeys.concat(lastResortPrekey))
      await this.box.load()
      preKeysDidUpload()
    } else {
      storeLogger.error(resp.toString())
    }
  }

  public updateUserStatusToOk = (user: Iuser) => {
    this.db.updateUserStatus(user, USER_STATUS.OK)
    runInAction(() => {
      if (this.currentUser && this.currentUser.userAddress === user.userAddress) {
        if (typeof this.currentEthereumNetwork === 'undefined') {
          return
        }
        this.currentUser = Object.assign({}, this.currentUser, {status: USER_STATUS.OK})

        const index = this.currentNetworkUsers
          .findIndex((_user) => _user.userAddress === (this.currentUser as Iuser).userAddress)
        if (index !== -1) {
          this.currentNetworkUsers[index] = this.currentUser
          this.currentNetworkUsers = this.currentNetworkUsers.slice(0)
        }
      }
    })
    this.db.updateUserStatus(user, USER_STATUS.OK)
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

  public getBoundEvents = async (
    lastFetchBlock: web3BlockType,
    userAddress: string,
  ) => {
    return await this.boundSocialsContract.getBindEvents({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0,
      filter: {
        userAddress
      }
    })
  }

  private fetchBoundEvents = async (
    lastFetchBlock = this.currentUserlastFetchBlockOfBoundSocials,
    userAddress = this.currentUser!.userAddress
  ) => {
    const {
      lastBlock,
      bindEvents
    } = await this.getBoundEvents(lastFetchBlock, userAddress)

    if (typeof this.currentUser === 'undefined' || bindEvents.length === 0) {
      return
    }
    const _user: Iuser = this.currentUser as Iuser

    for (let i = bindEvents.length - 1; i >= 0; i--) {
      const bindEvent = bindEvents[i]
      const _signedBoundSocial = JSON.parse(hexToUtf8(
        bindEvent.signedBoundSocials.slice(2))) as IsignedBoundSocials

      if (JSON.stringify(_signedBoundSocial.socialMedias) !== JSON.stringify(_user.boundSocials)) {
        const currentUserPublicKey = await this.getCurrentUserPublicKey()
        const userPublicKey = publicKeyFromHexStr(currentUserPublicKey.slice(2))
        if (userPublicKey.verify(
          sodium.from_hex(_signedBoundSocial.signature.slice(2)),
          JSON.stringify(_signedBoundSocial.socialMedias)
        )) {
          await this.updateBoundSocials(_signedBoundSocial.socialMedias, _user)
          break
        }
      }
    }
    await this.updateLastFetchBlockOfBoundSocials(lastBlock, _user)
  }

  private connectStatusDidChange(prevStatus: TRUSTBASE_CONNECT_STATUS, currentStatus: TRUSTBASE_CONNECT_STATUS) {
    this.connectStatusListener.forEach((listener) => {
      listener(prevStatus, currentStatus)
    })
  }

  private listenForEthereumAccountChange = async () => {
    const web3 = getWeb3()
    const accounts: string[] = await web3.eth.getAccounts().catch((err: Error) => {
      storeLogger.error(err)
      return []
    })

    if (accounts.length > 0) {
      if (this.currentEthereumAccount !== accounts[0]) {
        runInAction(() => {
          this.currentEthereumAccount = web3.eth.defaultAccount = accounts[0]
          const prevConnectStatus = this.connectStatus
          const currentConnectStatus = this.connectStatus = this.connectError ? CONTRACT_ADDRESS_ERROR : SUCCESS
          if (currentConnectStatus !== prevConnectStatus) {
            this.connectStatusDidChange(prevConnectStatus, currentConnectStatus)
          }
        })
      }
    } else if (this.connectStatus !== NO_ACCOUNT) {
      runInAction(() => {
        this.currentEthereumAccount = ''
        const prevConnectStatus = this.connectStatus
        this.connectStatus = NO_ACCOUNT
        this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
      })
    }
    window.clearTimeout(this.detectAccountChangeTimeout)
    this.detectAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
  }

  private listenForNetworkChange = async () => {
    const web3 = getWeb3()
    const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch((err: Error) => {
      storeLogger.error(err)
      return undefined
    })

    if (this.currentEthereumNetwork !== currentNetworkId) {
      window.clearTimeout(this.detectAccountChangeTimeout)
      if (typeof currentNetworkId === 'undefined') {
        runInAction(() => {
          this.offlineSelectedEthereumNetwork = this.currentEthereumNetwork
          this.currentEthereumNetwork = undefined
          const prevConnectStatus = this.connectStatus
          this.connectStatus = OFFLINE
          this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
        })
      } else {
        return this.processAfterNetworkConnected().catch((err: Error) => {
          storeLogger.error(err)
          this.processError(err)
        })
      }
    }
    window.clearTimeout(this.detectNetworkChangeTimeout)
    this.detectNetworkChangeTimeout = window.setTimeout(this.listenForNetworkChange, 100)
  }

  private processAfterNetworkConnected = async (
    globalSettings = this.globalSettings
  ) => {
    const web3 = getWeb3()
    const networkId: NETWORKS = await web3.eth.net.getId()
    const loadedData = await this.loadNetworkData(networkId)

    runInAction(() => {
      this.globalSettings = globalSettings as IglobalSettings
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
      ] = loadedData}
      this.newMessageCount = 0

      if (this.currentUser) {
        addUsedNetwork(networkId)
        setLastUsedUser(networkId, this.currentUser.userAddress)
        this.currentUserBoundSocials = this.currentUser.boundSocials
        this.currentUserBindingSocials = this.currentUser.bindingSocials
      }

      this.currentEthereumAccount = web3.eth.defaultAccount
      this.currentEthereumNetwork = networkId
      try {
        const {
          IdentitiesAddress,
          MessagesAddress,
          BroadcastMessagesAddress,
          BoundSocialsAddress,
        } = this.currentNetworkSettings

        this.identitiesContract = new Identities(Object.assign({
          address: IdentitiesAddress,
          networkId
        }))

        this.messagesContract = new Messages(Object.assign({
          address: MessagesAddress,
          networkId
        }))

        this.broadcastMessagesContract = new BroadcastMessages(Object.assign({
          address: BroadcastMessagesAddress,
          currentNetworkId: networkId
        }))

        this.boundSocialsContract = new BoundSocials(Object.assign({
          address: BoundSocialsAddress,
          currentNetworkId: networkId
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
      window.clearTimeout(this.detectAccountChangeTimeout)
      window.clearTimeout(this.detectNetworkChangeTimeout)
      this.detectAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
      this.detectNetworkChangeTimeout = window.setTimeout(this.listenForNetworkChange, 100)
    })
  }

  private loadUserData = (
    currentUser: Iuser | undefined
  ): Promise<IloadedUserData> => Promise.all([
    // currentUser
    Promise.resolve(currentUser),
    // box
    (async () => {
      if (!currentUser) {
        throw null
      }
      const store = new IndexedDBStore(`${currentUser.networkId}@${currentUser.userAddress}`)
      /**
       * Looks like cryptobox constructure function has a wrong signature...
       * Dont forget to set the second argument to 0 to disable cryptobox's
       * pre-keys auto-refill
       */
      let box: Cryptobox | undefined = new Cryptobox(store as any, 0)
      await box.load().catch((err: Error) => {
        storeLogger.error(err)
        box = undefined
      })
      return [store, box] as [IndexedDBStore, Cryptobox]
    })()
      .catch(() => {
        return [undefined, undefined] as [IndexedDBStore | undefined, Cryptobox | undefined]
      }),
    // contacts
    Promise.resolve(currentUser ? currentUser.contacts : []),
    // lastFetchBlock
    Promise.resolve(currentUser ? currentUser.lastFetchBlock : 0),
    // lastFetchBlockOfBroadcast
    Promise.resolve(currentUser ? currentUser.lastFetchBlockOfBroadcast : 0),
    // lastFetchBlockOfBoundSocials
    Promise.resolve(currentUser ? currentUser.lastFetchBlockOfBoundSocials : 0),
    ])

  private getPreKeys = async (userAddress: string) => {
    const uploadPreKeysUrl = process.env.REACT_APP_KVASS_ENDPOINT + userAddress
    const init = { method: 'GET', mode: 'cors' } as RequestInit
    const userIdentity = await this.identitiesContract.getIdentity(userAddress)
    const userPublicKey = publicKeyFromHexStr(userIdentity.publicKey.slice(2))

    const resp = await fetch(uploadPreKeysUrl, init)
    if (resp.status === 200) {
      const downloadedPreKeys = await resp.text()
      const [preKeysPackageSerializedStr, signature] = downloadedPreKeys.split(' ')
      if (preKeysPackageSerializedStr === '' || signature === '') {
        throw (new Error('the data is broken'))
      }

      if (!userPublicKey.verify(sodium.from_hex(signature), preKeysPackageSerializedStr)) {
        throw (new Error('the prekeys\'s signature is invalid.'))
      }

      if (preKeysPackageSerializedStr !== '') {
        return PreKeysPackage.deserialize(sodium.from_hex(preKeysPackageSerializedStr.slice(2)).buffer)
      }
    }
    throw (new Error('status is not 200'))
  }
  private updateBindingSocials = async (bindingSocials: IbindingSocials, user: Iuser) => {
      await this.db.updateBindingSocials(user, bindingSocials)
      runInAction(() => {
        this.currentUserBindingSocials = bindingSocials
      })
  }
  private updateBoundSocials = async (boundSocials: IboundSocials, user: Iuser) => {
      await this.db.updateBoundSocials(user, boundSocials)
      runInAction(() => {
        this.currentUserBoundSocials = boundSocials
      })
  }
  private updateLastFetchBlockOfBoundSocials = async (lastBlock: number, user: Iuser) => {
      const _newLastBlock = lastBlock < 3 ? 0 : lastBlock - 3
      await this.db.updateLastFetchBlockOfBoundSocials(user, _newLastBlock)
      runInAction(() => {
        this.currentUserlastFetchBlockOfBoundSocials = _newLastBlock
      })
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
      const userPublicKey = publicKeyFromHexStr(userIdentity.publicKey.slice(2))
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
                    const sessionInDB = await this.db.getSession(sessionTag, user.userAddress).catch(() => undefined)
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
      } = await this.identitiesContract.getIdentity(fromUserAddress).catch((err) => {
        storeLogger.error(err)
        return {blockNumber: 0, publicKey: ''}
      })

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

  private loadNetworkData = async (networkId: NETWORKS) => {
    let userAddress: string = getNetworkLastUsedUserAddress(networkId)
    let currentNetworkUsers: Iuser[] = []
    let user: Iuser | undefined

    if (userAddress) {
      user = await this.db.getUser(networkId, userAddress)
      if (!user) {
        userAddress = ''
      }
    }
    if (!userAddress) {
      currentNetworkUsers = await this.db.getUsers(networkId)
      user = currentNetworkUsers.length > 0 ? currentNetworkUsers[0] : undefined
    }

    return Promise.all([
      // currentNetworkSettings
      this.db.getNetworkSettings(networkId),
      // currentNetworkUsers
      currentNetworkUsers.length > 0
        ? Promise.resolve(currentNetworkUsers)
        : this.db.getUsers(networkId),
      // *userData
      Promise.resolve(user).then((_currentUser) => this.loadUserData(_currentUser))
    ])
  }

  private processError = (err: Error, globalSettings = this.globalSettings) => {
    let {
      networkId: lastUsedNetworkId
    } = getLastUsedUser()
    const usedNetworks: NETWORKS[] = getUsedNetworks()
    if (!lastUsedNetworkId && usedNetworks.length > 0) {
      lastUsedNetworkId = usedNetworks[0]
    }
    const changeStore = (reason: Error) => {
      runInAction(() => {
        this.globalSettings = globalSettings
        this.offlineSelectedEthereumNetwork = lastUsedNetworkId
        const prevConnectStatus = this.connectStatus
        this.connectStatus = ERROR
        this.connectError = reason
        this.connectStatusDidChange(prevConnectStatus, this.connectStatus)
      })
    }
    if (typeof lastUsedNetworkId !== 'undefined') {
      this.selectOfflineNetwork(lastUsedNetworkId, false, true, globalSettings, err).catch((_err: Error) => {
        storeLogger.error(_err)
        changeStore(_err)
      })
    } else {
      changeStore(err)
    }
  }
}

function generatePrekeys(start: number, interval: number, size: number) {
  if (size === 0) {
    return []
  }

  return Array(size).fill(0)
    .map((_, x) => PreKey.new(((start + (x * interval)) % PreKey.MAX_PREKEY_ID)))
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

function identityKeyFromHexStr(identityKeyHexString: string) {
  return keys.IdentityKey.new(publicKeyFromHexStr(identityKeyHexString))
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

function setLastUsedUser(networkId: NETWORKS, userAddress: string) {
  localStorage.setItem(
    LOCAL_STORAGE_KEYS.LAST_USED_USER,
    JSON.stringify({networkId, userAddress})
  )
  setNetworkLastUsedUserAddress(networkId, userAddress)
}

function getLastUsedUser(): {
  networkId?: NETWORKS,
  userAddress?: string
} {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_USED_USER) || '{}')
  } catch (err) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.USED_NETWORKS, '{}')
    return {}
  }
}

function setNetworkLastUsedUserAddress(networkId: NETWORKS, userAddress: string) {
  localStorage.setItem(
    `${LOCAL_STORAGE_KEYS
      .NETWORK_LAST_USED_USER_ADDRESS[0]}${networkId}${LOCAL_STORAGE_KEYS
        .NETWORK_LAST_USED_USER_ADDRESS[1]}`,
    userAddress
  )
}

function getNetworkLastUsedUserAddress(networkId: NETWORKS) {
  return (localStorage.getItem(
    `${LOCAL_STORAGE_KEYS
      .NETWORK_LAST_USED_USER_ADDRESS[0]}${networkId}${LOCAL_STORAGE_KEYS
        .NETWORK_LAST_USED_USER_ADDRESS[1]}`)
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
