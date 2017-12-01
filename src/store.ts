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
  IregisterRecord,
  IasyncProvider,
  IcheckRegisterLifecycle,
  IuploadPreKeysLifecycle,
  IcreateAccountLifecycle,
  InetworkSettings,
  IsendingLifecycle,
  IenvelopeHeader,
  Iuser
} from '../typings/interface.d'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  SENDING_FAIL_CODE,
  NETWORKS,
  MESSAGE_TYPE,
  LOCAL_STORAGE_KEYS
} from './constants'

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
  Cryptobox | undefined,
  string[],
  web3BlockType,
  Isession[]
]

export class Store {
  @observable public connectStatus: TRUSTBASE_CONNECT_STATUS = PENDING
  @observable public connectError: Error
  @observable.ref public globalSettings: IglobalSettings = {}
  @observable public currentEthereumNetwork: NETWORKS | undefined
  @observable public currentEthereumAccount = ''
  @observable.ref public offlineAvailableNetworks: NETWORKS[] = []
  @observable public offlineSelectedEthereumNetwork: NETWORKS | undefined
  @observable.ref public currentNetworkSettings: InetworkSettings | undefined
  @observable.ref public currentNetworkUsers: Iuser[] = []
  @observable.ref public currentUser: Iuser | undefined
  @observable.ref public currentUserContacts: string[] = []
  @observable.ref private currentUserSessions: Isession[] = []
  private currentUserlastFetchBlock: web3BlockType = 0
  private box: Cryptobox | undefined
  private identitiesContract: Identities
  private preKeysContract: PreKeys
  private messagesContract: Messages
  private accountChangeTimeout: number
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
          // FIXME
          let loadedResult: any
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
                  this.box,
                  this.currentUserContacts,
                  this.currentUserlastFetchBlock,
                  this.currentUserSessions
                ]
              ] = loadedResult}
            }
            this.connectStatus = NO_ACCOUNT
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
          const usedNetworks: NETWORKS[] = getUsedNetworks()
          if (!lastUsedNetworkId && usedNetworks.length > 0) {
            lastUsedNetworkId = usedNetworks[0]
          }
          if (typeof lastUsedNetworkId !== 'undefined') {
            this.selectOfflineNetwork(lastUsedNetworkId, true, globalSettings, err)
          } else {
            runInAction(() => {
              /**
               * In this case, we can't instantiate web3, user need to refresh the
               * page to retry.
               */
              this.globalSettings = globalSettings
              this.offlineAvailableNetworks = usedNetworks
              this.offlineSelectedEthereumNetwork = lastUsedNetworkId
              this.connectStatus = ERROR
              this.connectError = err
            })
          }
        }
      })
  }

  public register = async (username: string, {
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    registerRecordDidSave = noop,
    accountWillCreate = noop,
    accountDidCreate = noop,
    registerDidComplete = noop,
    registerDidFail = noop,
    transactionCreationDidCatch = registerDidFail,
    registerRecordStorageDidCatch = registerDidFail,
    accountCreationDidCatch = registerDidFail,
    preKeysUploadDidCatch = registerDidFail
  }: IregisterLifecycle = {}) => {
    if (this.connectStatus !== SUCCESS) {
      return registerDidFail(null, REGISTER_FAIL_CODE.NOT_CONNECTED)
    }

    if (username === '') {
      return registerDidFail(null, REGISTER_FAIL_CODE.INVALID_USERNAME)
    }

    const web3 = getWeb3()
    const usernameHash = web3.utils.sha3(username)

    if (Object.keys(this.currentNetworkUsers).includes(username)) {
      return registerDidFail(null, REGISTER_FAIL_CODE.FOUND_ON_LOCAL)
    }

    // const store = new IndexedDBStore(usernameHash)
    // if (await store.load_identity().catch(() => null)) {
    //   // Account record corrupted, we can never recover the username again
    //   return onRegisterFailed(REGISTER_FAIL_CODE.FOUND_ON_LOCAL)
    // }

    const currentNetworkId = this.currentEthereumNetwork as NETWORKS

    const registerRecord = await this.db.getRegisterRecord(currentNetworkId, usernameHash)
    if (registerRecord) {
      return this.checkRegister(username, {
        accountWillCreate,
        accountDidCreate,
        registerDidComplete,
        registerDidFail
      })
    }
    // check if registered, avoid unnecessary transaction
    const { publicKey: identityKeyString } = await this.identitiesContract
      .getIdentity(username)
      .catch((err) => {
        registerDidFail(err)
        return {publicKey: undefined}
      })
    if (!identityKeyString) {
      return
    }
    if (Number(identityKeyString) !== 0) {
      return registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
    }

    const identityKeyPair = IdentityKeyPair.new()
    const newIdentityKeyString = `0x${identityKeyPair.public_key.fingerprint()}`

    transactionWillCreate()

    const transactionConfirmation = async (confirmationNumber: number) => {
      if (confirmationNumber === 10) {
        this.db.deleteRegisterRecord(currentNetworkId, usernameHash).catch(noop)

        const {
          publicKey: registeredIdentityKeyString
        } = await this.identitiesContract.getIdentity(username)
          .catch(() => {
            return {publicKey: undefined}
          })
        if (!registeredIdentityKeyString) {
          window.setTimeout(transactionConfirmation, 1000, 10)
          return
        }
        if (registeredIdentityKeyString === newIdentityKeyString) {
          await this.createAccount(username, usernameHash, identityKeyPair, {
            accountWillCreate,
            accountDidCreate,
            accountCreationDidCatch,
            preKeysUploadDidCatch
          })
          registerDidComplete()
        } else {
          registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
        }
      }
    }

    this.identitiesContract.register(username, newIdentityKeyString)
      .on('transactionHash', (transactionHash) => {
        transactionDidCreate(transactionHash)
        const newRegisterRecord: IregisterRecord = {
          networkId: currentNetworkId,
          usernameHash,
          keyPair: sodium.to_hex(new Uint8Array(identityKeyPair.serialise())),
          transactionHash
        }
        this.db.createRegisterRecord(newRegisterRecord)
          .then(() => registerRecordDidSave(transactionHash))
          .catch(registerRecordStorageDidCatch)
      })
      .on('confirmation', transactionConfirmation)
      .on('error', (err) => {
        this.db.deleteRegisterRecord(currentNetworkId, usernameHash).catch(noop)
        transactionCreationDidCatch(err)
      })
  }

  public async checkRegister(username: string, {
    accountWillCreate = noop,
    accountDidCreate = noop,
    registerDidComplete = noop,
    registerDidFail = noop,
    accountCreationDidCatch = registerDidFail,
    preKeysUploadDidCatch = registerDidFail
  }: IcheckRegisterLifecycle = {}) {
    if (this.connectStatus !== SUCCESS) {
      return registerDidFail(null, REGISTER_FAIL_CODE.NOT_CONNECTED)
    }

    if (username === '') {
      return registerDidFail(null, REGISTER_FAIL_CODE.INVALID_USERNAME)
    }

    const web3 = getWeb3()
    const usernameHash = web3.utils.sha3(username)

    const currentNetworkId = this.currentEthereumNetwork as NETWORKS

    const registerRecord = await this.db.getRegisterRecord(currentNetworkId, usernameHash)
    if (!registerRecord) {
      return registerDidFail(new Error('Register record not found'))
    }
    const {
      transactionHash,
      keyPair: keyPairHexString
    } = registerRecord
    const identityKeyPair = IdentityKeyPair.deserialise(sodium.from_hex(keyPairHexString).buffer)

    const waitForTransactionReceipt = async (counter = 0) => {
      const receipt = await web3.eth.getTransactionReceipt(transactionHash)
        .catch(() => null)
      if (receipt !== null) {
        if (counter >= 10) {
          this.db.deleteRegisterRecord(currentNetworkId, usernameHash).catch(noop)
          const {
            publicKey: registeredIdentityKeyString
          } = await this.identitiesContract.getIdentity(username)
            .catch(() => {
              return {publicKey: undefined}
            })
          if (!registeredIdentityKeyString) {
            return window.setTimeout(waitForTransactionReceipt, 1000, counter)
          }
          if (registeredIdentityKeyString === `0x${identityKeyPair.public_key.fingerprint()}`) {
            await this.createAccount(username, usernameHash, identityKeyPair, {
              accountWillCreate,
              accountDidCreate,
              accountCreationDidCatch,
              preKeysUploadDidCatch
            })
            return registerDidComplete()
          } else {
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
      sendingDidFail = noop,
      transactionCreationDidCatch = sendingDidFail
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
      publicKey: identityKeyString
    } = await this.identitiesContract.getIdentity(toUsernameHash, { isHash: true })
      .catch((err) => {
        sendingDidFail(err)
        return {publicKey: undefined}
      })
    if (!identityKeyString) {
      return
    }
    if (Number(identityKeyString) === 0) {
      return sendingDidFail(null, SENDING_FAIL_CODE.INVALID_USERNAME)
    }

    let session: CryptoboxSession | null = null
    if (sessionTag !== '') {
      // Is reply
      // Try to load local session and save to cache..
      session = await this.box.session_load(sessionTag).catch((err) => {
        if (err.name !== 'RecordNotFoundError') {
          // Maybe we have a corrupted session on local, delete it.
          (this.box as Cryptobox).session_delete(sessionTag)
        }
        return null
      })
    }

    const {
      interval,
      lastPrekeyDate,
      preKeyPublicKeys
    } = await this.getPreKeys(toUsernameHash, true)

    const {
      id: preKeyID,
      publicKey: preKeyPublicKey
    } = getPreKey({
      interval,
      lastPrekeyDate,
      preKeyPublicKeys
    })

    const fromUsername = currentUser.username
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
        }))

        const identityKey = identityKeyFromHexStr(identityKeyString.slice(2))
        const preKeyBundle = PreKeyBundle.create(identityKey, preKeyPublicKey, preKeyID)

        const encryptedMessage = await (this.box as Cryptobox).encrypt(
          toUsernameHash,
          paddedMessage,
          preKeyBundle.serialise()
        )

        const proteusEnvelope = proteusMessage.Envelope.deserialise(encryptedMessage)
        const preKeyMessage: proteusMessage.PreKeyMessage = proteusEnvelope.message as any
        const cipherMessage = preKeyMessage.message
        const header = {
          mac: proteusEnvelope.mac,
          baseKey: preKeyMessage.base_key,
          sessionTag: sessionTag === '' ? makeSessionTag() : sessionTag,
          isPreKeyMessage: true,
          messageByteLength
        }

        return {
          messageType: _messageType,
          usingSessionTag: header.sessionTag,
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
        }))

        const encryptedMessage = await (this.box as Cryptobox).encrypt(
          toUsernameHash,
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
    await this.messagesContract.publish(`0x${keymailEnvelope.encrypt(preKeyID, preKeyPublicKey)}`)
    .on('transactionHash', transactionDidCreate)
    .on('confirmation', async (confirmationNumber, receipt) => {
      if (confirmationNumber === 10) {
        if (!receipt.events) {
          sendingDidFail(new Error('Unknown error'))
          return
        }
        const confirmedTimestamp: number = Number(
          (((receipt.events.Publish || {}).returnValues || {}) as any).timestamp || Math.round(Date.now() / 1000))

        const createNewSession = async () => {
          await this.db.createSession({
            user: currentUser,
            contact: toUsername,
            subject,
            sessionTag: usingSessionTag,
            messageType,
            timestamp: confirmedTimestamp,
            plainText,
            isFromYourself,
            fromUsername
          })
        }
        if (sessionTag === usingSessionTag) {
          await createNewSession()
        } else {
          // cryptobox session corrupted
          const oldSession = await this.db.getSession(sessionTag)
          if (!oldSession) {
            await createNewSession()
          } else {
            await this.db.createMessage({
              user: currentUser,
              messageType,
              sessionTag,
              timestamp: confirmedTimestamp,
              plainText,
              isFromYourself
            })
            await this.db.addContact(currentUser, toUsername)
          }
        }

        const newSessions = await this.db.getSessions(currentUser)
        runInAction(() => {
          if (!this.currentUserContacts.includes(toUsername)) {
            this.currentUserContacts = this.currentUserContacts.concat(toUsername)
          }
          this.currentUserSessions = newSessions
        })
        return sendingDidComplete()
      }
    })
    .on('error', transactionCreationDidCatch)
  }

  public useUser = async (user: Iuser) => {
    const networkId = this.currentEthereumNetwork || this.offlineSelectedEthereumNetwork as NETWORKS
    const userData = await this.loadUserData(user)
    runInAction(() => {
      [
        this.currentUser,
        this.box,
        this.currentUserContacts,
        this.currentUserlastFetchBlock,
        this.currentUserSessions
      ] = userData
      addUsedNetwork(networkId)
      setLastUsedUser(networkId, user.usernameHash)
    })
  }

  public selectOfflineNetwork = async (
    networkId: NETWORKS,
    isFirstConnect: boolean = false,
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

      currentNetworkUsers.length > 0 ? Promise.resolve(currentNetworkUsers) : this.db.getUsers(networkId),

      this.db.getUser(networkId, usernameHash)
        .catch(() => this.currentUser)
        .then((currentUser) => this.loadUserData(currentUser))
    ])}

    runInAction(() => {
      if (isFirstConnect) {
        this.globalSettings = globalSettings as IglobalSettings
        this.offlineAvailableNetworks = getUsedNetworks()
        this.connectStatus = ERROR
        this.connectError = err as Error
      }
      this.currentNetworkSettings = currentNetworkSettings
      this.currentNetworkUsers = currentNetworkUsers
      this.offlineSelectedEthereumNetwork = networkId
      {[
        this.currentUser,
        , // this.box,
        , // this.contacts,
        , // this.lastFetchBlock,
        this.currentUserSessions
      ] = loadedUserData}
    })
  }

  private async createAccount(username: string, usernameHash: string, identityKeyPair: keys.IdentityKeyPair, {
    accountWillCreate = noop,
    accountDidCreate = noop,
    accountCreationDidCatch = noop,
    preKeysUploadDidCatch = noop,
  }: IcreateAccountLifecycle) {
    accountWillCreate()
    const currentNetworkId = this.currentEthereumNetwork as NETWORKS
    const store = new IndexedDBStore(usernameHash)
    await store.save_identity(identityKeyPair).catch(accountCreationDidCatch)
    await this.db.createUser({
      networkId: currentNetworkId,
      username,
      usernameHash,
      owner: this.currentEthereumAccount
    }).catch(accountCreationDidCatch)
    const newUser = await this.db.getUser(currentNetworkId, usernameHash) as Iuser
    this.currentNetworkUsers.push(newUser)
    accountDidCreate()
    return this.uploadPreKeys(username, undefined, undefined, store, {
      preKeysUploadDidCatch
    })
  }

  private async uploadPreKeys(username: string, interval = 1, numOfPreKeys = 100, store: IndexedDBStore, {
    transactionWillCreate = noop,
    preKeysDidUpload = noop,
    preKeysUploadDidCatch = noop,
    transactionCreationDidCatch = preKeysUploadDidCatch
  }: IuploadPreKeysLifecycle) {
    const preKeys = generatePrekeys(unixToday(), interval, numOfPreKeys)
    const preKeysPublicKeys: IpreKeyPublicKeys = preKeys.reduce((result, preKey) => Object.assign(result, {
      [preKey.key_id]: `0x${preKey.key_pair.public_key.fingerprint()}`
    }), {})
    // use lastPreKey as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair
    const preKeysPackage = new PreKeysPackage(preKeysPublicKeys, interval, lastPreKey.key_id)

    transactionWillCreate()
    await this.preKeysContract.upload(username, `0x${sodium.to_hex(new Uint8Array(preKeysPackage.serialise()))}`)
      .catch(transactionCreationDidCatch)

    await store.save_prekeys(preKeys.concat(lastResortPrekey)).catch(preKeysUploadDidCatch)
    preKeysDidUpload()
  }

  private listenForEthereumAccountChange = async () => {
    const web3 = getWeb3()
    const accounts = await web3.eth.getAccounts().catch(() => [] as string[])
    if (accounts.length > 0) {
      if (this.currentEthereumAccount !== accounts[0]) {
        runInAction(() => {
          this.currentEthereumAccount = web3.eth.defaultAccount = accounts[0]
          this.connectStatus = this.connectError ? CONTRACT_ADDRESS_ERROR : SUCCESS
        })
      }
    } else if (this.connectStatus !== NO_ACCOUNT) {
      runInAction(() => {
        this.currentEthereumAccount = ''
        this.offlineAvailableNetworks = getUsedNetworks()
        this.connectStatus = NO_ACCOUNT
      })
    }
    this.accountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
  }

  private listenForNetworkChange = async () => {
    const web3 = getWeb3()
    const currentNetworkId: NETWORKS | undefined = await web3.eth.net.getId().catch(() => undefined)

    if (this.currentEthereumNetwork !== currentNetworkId) {
      if (typeof currentNetworkId === 'undefined') {
        window.clearTimeout(this.accountChangeTimeout)

        runInAction(() => {
          this.currentEthereumNetwork = undefined
          this.offlineSelectedEthereumNetwork = currentNetworkId
          this.offlineAvailableNetworks = getUsedNetworks()
          this.connectStatus = OFFLINE
        })
      } else {
        window.clearTimeout(this.accountChangeTimeout)
        return this.processAfterNetworkConnected()
      }
    }
    window.setTimeout(this.listenForNetworkChange, 100)
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
          this.box,
          this.currentUserContacts,
          this.currentUserlastFetchBlock,
          this.currentUserSessions
        ]
      ] = loadedResult}

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
          address: MessagesAddress
        }))

        this.connectStatus = SUCCESS
      } catch (err) {
        // have trouble with contract instantiation.
        this.connectStatus = CONTRACT_ADDRESS_ERROR
        this.connectError = err
      }
      this.accountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
      window.setTimeout(this.listenForNetworkChange, 100)
    })
  }

  private loadUserData = (
    currentUser: Iuser | undefined
  ) => Promise.all([
    // currentUser
    Promise.resolve(currentUser),
    // box
    (async () => {
      if (!currentUser) {
        return this.box
      }
      const store = new IndexedDBStore(currentUser.usernameHash)
      /**
       * Looks like cryptobox constructure function has a wrong signature...
       * Dont forget to set the second argument to 0 to disable cryptobox's
       * pre-keys auto-refill
       */
      const box = new Cryptobox(store as any, 0)
      await box.load()
      return box
    })()
      .catch(() => this.box),
    // contacts
    Promise.resolve(currentUser ? currentUser.contacts : this.currentUserContacts),
    // lastFetchBlock
    Promise.resolve(currentUser ? currentUser.lastFetchBlock : this.currentUserlastFetchBlock),
    // sessions
    currentUser ? this.db.getSessions(currentUser) : Promise.resolve(this.currentUserSessions)
    ])

  private getPreKeys = async (usernameOrUsernameHash: string, isHash: boolean = false) => {
    const preKeysPackageSerializedStr = await this.preKeysContract.getPreKeys(
      usernameOrUsernameHash,
      { isHash }
    )

    return PreKeysPackage.deserialize(sodium.from_hex(preKeysPackageSerializedStr.slice(2)).buffer)
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
  const result = new Uint8Array(512).fill(0xFF) // fill random number?
  result.set(typeArrayText)
  return {
    result,
    messageByteLength
  }
}

// function unpad512BytesMessage(padded512BytesMessage: Uint8Array, messageByteLength: number) {
//   return sodium.to_string(padded512BytesMessage.subarray(
//     0,
//     messageByteLength
//   ))
// }

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
