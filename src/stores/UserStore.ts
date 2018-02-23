import {
  observable,
  computed,
  reaction,
  runInAction,
  action,
} from 'mobx'
import {
  MetaMaskStore,
  ETHEREUM_NETWORKS,
  CONFIRMATION_NUMBER,
  TRANSACTION_TIME_OUT_BLOCK_NUMBER,
  AVERAGE_BLOCK_TIME,
  TRANSACTION_STATUS,
} from './MetaMaskStore'
import {
  ContractStore,
} from './ContractStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
} from './UsersStore'
import {
  SessionsStore,
} from './SessionsStore'
import {
  ChatMessagesStore,
} from './ChatMessagesStore'

import {
  Cryptobox,
} from 'wire-webapp-cryptobox'
import {
  keys,
} from 'wire-webapp-proteus'
const {
  PreKey,
} = keys

import {
  noop,
} from '../utils'
import {
  isHexZeroValue,
  hexFromUint8Array,
} from '../utils/hex'
import {
  getPublicKeyFingerPrint,
} from '../utils/proteus'
import {
  unixToday,
} from '../utils/time'
import {
  storeLogger,
} from '../utils/loggers'
import {
  dumpCryptobox,
  IDumpedDatabases,
  downloadObjectAsJson,
} from '../utils/data'

import {
  getDatabases,
} from '../databases'
import {
  UsersDB,
  IUpdateUserOptions,
} from '../databases/UsersDB'

import IndexedDBStore from '../IndexedDBStore'
import {
  PreKeysPackage,
  IPreKeyPublicKeyFingerprints,
} from '../PreKeysPackage'

import {
  BoundSocialsStore,
} from './BoundSocialsStore'

/**
 * **NOTE**: You need to run `userStore.initCryptobox()` and
 * check `userStore.isCryptoboxReady` before using the store to
 * sign/encrypt/decrypt messages
 */
export class UserStore {
  // FIXME consider @observable.ref
  @observable public user: IUser
  @observable public isCryptoboxReady = false

  public sessionsStore: SessionsStore
  public boundSocialsStore: BoundSocialsStore
  public chatMessagesStore: ChatMessagesStore

  private userRef: IUser
  private usersDB: UsersDB

  private indexedDBStore: IndexedDBStore
  private cryptoBox: Cryptobox

  @computed
  public get avatarHash() {
    return UsersStore.getAvatarHashByUser(this.user)
  }

  @computed
  public get isRegisterCompleted() {
    const status = this.user.status
    return (
      status === USER_STATUS.OK
      || status === USER_STATUS.FAIL
    )
  }

  constructor(
    user: IUser,
    private metaMaskStore: MetaMaskStore,
    private contractStore: ContractStore,
    private usersStore: UsersStore,
  ) {
    this.user = this.userRef = user
    this.usersDB = getDatabases().usersDB

    const indexedDBStore = this.indexedDBStore = new IndexedDBStore(`${user.networkId}@${user.userAddress}`)
    const cryptoBox = this.cryptoBox = new Cryptobox(indexedDBStore as any, 0)

    this.sessionsStore = new SessionsStore({
      userStore: this,
    })
    this.boundSocialsStore = new BoundSocialsStore({
      userStore: this,
      contractStore: this.contractStore,
      userCachesStore: this.usersStore.userCachesStore,
    })
    this.chatMessagesStore = new ChatMessagesStore({
      userStore: this,
      contractStore,
      metaMaskStore,
      indexedDBStore,
      cryptoBox,
    })

    this.initCryptobox()

    reaction(
      () => ({
        status: this.user.status,
        blockHash: this.user.blockHash,
        lastFetchBlockOfChatMessages: this.user.lastFetchBlockOfChatMessages,
        contacts: this.user.contacts,
      }) as IUpdateUserOptions,
      (observableUserData) => {
        const oldStatus = this.userRef.status
        Object.assign(this.userRef, observableUserData)

        if (
          oldStatus !== USER_STATUS.OK
          && observableUserData.status === USER_STATUS.OK
        ) {
          // refresh usableUsers
          this.usersStore.users = this.usersStore.users.slice()
        }
      })
  }

  /**
   * Initialise cryptobox
   *
   * Run this function before using store to sign/encrypt/decrypt messages
   */
  public async initCryptobox() {
    if (!this.isCryptoboxReady) {
      await this.cryptoBox.load()
      runInAction(() => {
        this.isCryptoboxReady = true
      })
    }
  }

  public async reloadCryptobox() {
    this.cryptoBox = new Cryptobox(this.indexedDBStore as any, 0)
    await this.cryptoBox.load()
    return this.cryptoBox
  }

  public checkIdentityUploadStatus = async (
    {
      checkIdentityUploadStatusWillStart = noop,
      identityDidUpload = noop,
      registerDidFail = noop,
      checkingDidFail = noop,
    }: ICheckIdentityUploadStatusLifecycle = {},
  ) => {
    const { user } = this
    if (user.status === USER_STATUS.IDENTITY_UPLOADED) {
      return identityDidUpload()
    }

    const {
      getTransactionReceipt,
      getBlockHash,
    } = this.metaMaskStore
    const { identitiesContract } = this.contractStore
    const {
      networkId,
      userAddress,
      identityTransactionHash,
    } = user
    const identityKeyPair = this.isCryptoboxReady ? this.cryptoBox.identity : await this.indexedDBStore.load_identity()

    checkIdentityUploadStatusWillStart(identityTransactionHash)
    const waitForTransactionReceipt = async (blockCounter = 0, confirmationCounter = 0) => {
      try {
        const receipt = await getTransactionReceipt(identityTransactionHash)
        if (receipt) {
          if (confirmationCounter >= CONFIRMATION_NUMBER) {
            const hasStatus = receipt.status !== 'undefined'
            const hasTransactionError = hasStatus
              ? Number(receipt.status) === TRANSACTION_STATUS.FAIL
              : receipt.gasUsed === receipt.cumulativeGasUsed
            if (hasTransactionError) {
              await this.updateUser(
                {
                  status: USER_STATUS.FAIL,
                },
              )
              return registerDidFail(REGISTER_FAIL_CODE.TRANSACTION_ERROR)
            }

            const {
              blockNumber,
              publicKey: registeredIdentityFingerprint,
            } = await identitiesContract.getIdentity(userAddress)
            if (!registeredIdentityFingerprint || isHexZeroValue(registeredIdentityFingerprint)) {
              // we have receipt but found no identity,
              // set confirmationCounter to 0 and retry
              window.setTimeout(
                waitForTransactionReceipt, AVERAGE_BLOCK_TIME, blockCounter + 1,
              )
              return
            }

            if (registeredIdentityFingerprint === getPublicKeyFingerPrint(identityKeyPair.public_key)) {
              const blockHash = await getBlockHash(blockNumber)
              if (isHexZeroValue(blockHash)) {
                // no blockHash? just retry.
                const retryTimeOut = 1000
                window.setTimeout(
                  waitForTransactionReceipt, retryTimeOut, blockCounter, confirmationCounter,
                )
                return
              }
              await this.updateUser(
                {
                  blockHash,
                  status: USER_STATUS.IDENTITY_UPLOADED,
                },
              )
              identityDidUpload()
            } else {
              this.usersStore.deleteUser(networkId, userAddress)
              registerDidFail(REGISTER_FAIL_CODE.OCCUPIED)
            }
          } else {
            window.setTimeout(waitForTransactionReceipt, AVERAGE_BLOCK_TIME, blockCounter + 1, confirmationCounter + 1)
          }
          return
        }

        if (blockCounter >= TRANSACTION_TIME_OUT_BLOCK_NUMBER) {
          checkingDidFail(null, IDENTITY_UPLOAD_CHECKING_FAIL_CODE.TIMEOUT)
          return
        }

        window.setTimeout(waitForTransactionReceipt, AVERAGE_BLOCK_TIME, blockCounter + 1)
      } catch (err) {
        checkingDidFail(err)
        return
      }
    }

    return waitForTransactionReceipt()
  }

  public async refreshMemoryUser() {
    const user = await this.usersDB.getUser(this.user.networkId, this.user.userAddress)
    if (typeof user !== 'undefined') {
      this.updateMemoryUser(user)
    }
  }

  public sign(message: string) {
    return hexFromUint8Array(this.cryptoBox.identity.secret_key.sign(message))
  }

  public uploadPreKeys = async (
    {
      // FIXME: what the hell? should not need callback. throw if fail, return if didUpload...
      preKeysDidUpload = noop,
      preKeysUploadDidFail = noop,
      isRegister = false,
    }: IUploadPreKeysOptions = {},
  ) => {
    const interval = 1
    const preKeys = generatePreKeys(unixToday(), interval, 365)

    const preKeysPublicKeyFingerprints: IPreKeyPublicKeyFingerprints = preKeys.reduce(
      (result, preKey) => Object.assign(result, {
        [preKey.key_id]: getPublicKeyFingerPrint(preKey.key_pair.public_key),
      }),
      {},
    )

    // use last pre-key as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const identity = this.isCryptoboxReady ? this.cryptoBox.identity : await this.indexedDBStore.load_identity()
    const preKeysPackage = new PreKeysPackage(preKeysPublicKeyFingerprints, interval, lastPreKey.key_id)
    const serializedPrekeys = hexFromUint8Array(new Uint8Array(preKeysPackage.serialise()))
    const prekeysSignature = hexFromUint8Array(identity.secret_key.sign(serializedPrekeys))

    const uploadPreKeysUrl = `${process.env.REACT_APP_KVASS_ENDPOINT}${this.user.userAddress}`
    const resp = await fetch(
      uploadPreKeysUrl,
      {
        method: 'PUT',
        mode: 'cors',
        body: `${serializedPrekeys} ${prekeysSignature}`,
      },
    )

    if (resp.status === 201) {
      const store = this.indexedDBStore
      if (!isRegister) {
        await this.deleteAllPreKeys()
      }
      await store.save_prekeys(preKeys.concat(lastResortPrekey))
      if (this.isCryptoboxReady) {
        await this.cryptoBox.load()
      }
      if (isRegister) {
        await this.updateUser({
          status: USER_STATUS.OK,
        })
      }
      preKeysDidUpload()
    } else {
      storeLogger.error(resp)
    }
  }

  public exportUser = async () => {
    const {
      sessionsDB,
      messagesDB,
    } = getDatabases()
    const data: IDumpedDatabases = {}
    const user = this.user
    data.keymesh = [
      { table: 'users', rows: [user] },
      { table: 'sessions', rows: await sessionsDB.getSessions(user) },
      { table: 'messages', rows: await messagesDB.getMessagesOfUser(user) },
    ]
    const cryptobox = await dumpCryptobox(user)
    data[cryptobox.dbname] = cryptobox.tables
    downloadObjectAsJson(data, `keymesh@${user.networkId}@${user.userAddress}`)
  }

  public deleteOutdatedPreKeys = async () => {
    const store = this.indexedDBStore
    const preKeysFromStorage = await store.load_prekeys()
    const today = unixToday()
    return Promise.all(preKeysFromStorage
      .filter((preKey) => Number(preKey.key_id) < today)
      .map((preKeyToDelete) => store.deletePrekey(preKeyToDelete.key_id)))
  }

  private async deleteAllPreKeys() {
    const store = this.indexedDBStore
    const preKeysFromStorage = await store.load_prekeys()
    return Promise.all(preKeysFromStorage.map((preKeyToDelete) => store.deletePrekey(preKeyToDelete.key_id)))
  }

  private updateUser = async (args: IUpdateUserOptions) => {
    await this.usersDB.updateUser(
      this.user,
      args,
    )
    this.updateMemoryUser(args)
  }

  @action
  private updateMemoryUser = async (args: IUpdateUserOptions) => {
    Object.assign(this.user, args)
  }
}

function generatePreKeys(start: number, interval: number, size: number) {
  return Array(size).fill(0)
    .map((_, x) => PreKey.new(((start + (x * interval)) % PreKey.MAX_PREKEY_ID)))
}

export enum IDENTITY_UPLOAD_CHECKING_FAIL_CODE {
  UNKNOWN = 0,
  TIMEOUT,
}

export enum USER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADED,
  OK,
  FAIL,
}

interface ICheckIdentityUploadStatusLifecycle {
  checkIdentityUploadStatusWillStart?: (hash: string) => void
  identityDidUpload?: () => void
  registerDidFail?: (code: REGISTER_FAIL_CODE) => void
  checkingDidFail?: (err: Error | null, code?: IDENTITY_UPLOAD_CHECKING_FAIL_CODE) => void
}

interface IUploadPreKeysOptions {
  isRegister?: boolean
  preKeysDidUpload?: () => void
  preKeysUploadDidFail?: (err: Error) => void
}

export interface IUserIdentityKeys {
  networkId: ETHEREUM_NETWORKS,
  userAddress: string,
}

export interface IUser extends IUserIdentityKeys {
  status: USER_STATUS
  blockHash: string
  identityTransactionHash: string
  lastFetchBlockOfChatMessages: number

  // FIXME: should not belong here. Should not require `refreshMemoryUser` when `sendMessage`
  contacts: IContact[]
}

export interface IContact {
  userAddress: string
  blockHash: string
}
