import {
  observable,
  computed,
  reaction,
  runInAction,
} from 'mobx'
import {
  EthereumStore,
  ETHEREUM_NETWORKS,
} from './EthereumStore'
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
  sha3,
} from 'trustbase'

const sodium = require('libsodium-wrappers-sumo')
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
} from '../utils/hex'
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
  Databases,
} from '../databases'

import IndexedDBStore from '../IndexedDBStore'
import {
  PreKeysPackage,
  IPreKeyPublicKeys,
} from '../PreKeysPackage'

import {
  BoundSocialsStore,
  IBoundSocials,
  IBindingSocials,
} from './BoundSocialsStore'

export class UserStore {
  // FIXME consider @observable.ref
  @observable public user: IUser
  @observable.ref public sessionsStore: SessionsStore
  @observable public isCryptoboxReady = false
  public boundSocialsStore: BoundSocialsStore

  @computed
  public get avatarHash() {
    return this.user.status === USER_STATUS.PENDING
      ? ''
      : sha3(`${this.user.userAddress}${this.user.blockHash}`)
  }

  @computed
  public get isRegisterCompleted() {
    return this.user.status === USER_STATUS.OK
  }

  @computed
  public get isCorrespondingEthereumAddressAccount() {
    return this.user.userAddress === this.ethereumStore.currentEthereumAccount
  }

  constructor(user: IUser, {
    databases,
    ethereumStore,
    contractStore,
    usersStore,
  }: {
    databases: Databases
    ethereumStore: EthereumStore
    contractStore: ContractStore
    usersStore: UsersStore
  }) {
    this.user = this.userRef = user
    this.databases = databases
    this.ethereumStore = ethereumStore
    this.contractStore = contractStore
    this.usersStore = usersStore
    this.sessionsStore = new SessionsStore({
      databases,
      userStore: this,
    })
    this.boundSocialsStore = new BoundSocialsStore({
      databases,
      userStore: this,
      contractStore: this.contractStore,
    })
    this.loadDataFromLocal()

    reaction(
      () => ({
        status: this.user.status,
        blockHash: this.user.blockHash,
      }) as IUser,
      (observableUserData) => {
        if (observableUserData.status === USER_STATUS.OK) {
          // refresh usableUsers
          this.usersStore.users = this.usersStore.users.slice()
        }
        Object.assign(this.userRef, observableUserData)
      })
  }

  private userRef: IUser
  private databases: Databases
  private ethereumStore: EthereumStore
  private contractStore: ContractStore
  private usersStore: UsersStore
  private indexedDBStore: IndexedDBStore
  private box: Cryptobox

  public checkIdentityUploadStatus = async (
    {
      checkRegisterWillStart = noop,
      identityDidUpload = noop,
      registerDidFail = noop,
    }: ICheckIdentityUploadStatusLifecycle = {}
  ) => {
    const user = this.user
    if (user.status === USER_STATUS.IDENTITY_UPLOADED) {
      return identityDidUpload()
    }

    const {
      web3,
      getBlockHash,
    } = this.ethereumStore
    const { identitiesContract } = this.contractStore
    const {
      networkId,
      userAddress,
      identityTransactionHash,
    } = user
    const identityKeyPair = this.isCryptoboxReady ? this.box.identity : await this.indexedDBStore.load_identity()

    checkRegisterWillStart(identityTransactionHash)
    const waitForTransactionReceipt = async (counter = 0) => {
      const receipt = await web3.eth.getTransactionReceipt(identityTransactionHash)
      if (receipt) {
        if (counter >= Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          const {
            blockNumber,
            publicKey: registeredIdentityFingerprint
          } = await identitiesContract.getIdentity(userAddress)
          if (!registeredIdentityFingerprint || isHexZeroValue(registeredIdentityFingerprint)) {
            // we have receipt but found no identity, retry
            return window.setTimeout(waitForTransactionReceipt, 1000, counter)
          }

          if (registeredIdentityFingerprint === `0x${identityKeyPair.public_key.fingerprint()}`) {
            const blockHash = await getBlockHash(blockNumber)
            if (isHexZeroValue(blockHash)) {
              return window.setTimeout(waitForTransactionReceipt, 1000, counter)
            }
            try {
              await this.databases.usersDB.updateUser(
                user,
                {
                  blockHash,
                  status: USER_STATUS.IDENTITY_UPLOADED
                }
              )
              runInAction(() => {
                this.user.status = USER_STATUS.IDENTITY_UPLOADED
                this.user.blockHash = blockHash
              })
              return identityDidUpload()
            } catch (err) {
              return registerDidFail(err)
            }
          } else {
            this.usersStore.deleteUser(networkId, userAddress)
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

  public sign = (message: string) => {
    if (typeof this.box === 'undefined') {
      return '0x0'
    }

    return '0x' + sodium.to_hex(this.box.identity.secret_key.sign(message))
  }

  public uploadPreKeys = async (
    {
      preKeysDidUpload = noop,
      preKeysUploadDidFail = noop,
      isRegister = false
    }: IUploadPreKeysOptions = {}
  ) => {
    const interval = 1
    const preKeys = generatePreKeys(unixToday(), interval, 365)

    const preKeysPublicKeys: IPreKeyPublicKeys = preKeys.reduce(
      (result, preKey) => Object.assign(result, {
        [preKey.key_id]: `0x${preKey.key_pair.public_key.fingerprint()}`
      }),
      {}
    )

    // use last pre-key as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const identity = this.isCryptoboxReady ? this.box.identity : await this.indexedDBStore.load_identity()
    const preKeysPackage = new PreKeysPackage(preKeysPublicKeys, interval, lastPreKey.key_id)
    const serializedPrekeys = `0x${sodium.to_hex(new Uint8Array(preKeysPackage.serialise()))}`
    const prekeysSignature = `0x${sodium.to_hex(identity.secret_key.sign(serializedPrekeys))}`

    const uploadPreKeysUrl = `${process.env.REACT_APP_KVASS_ENDPOINT}${this.user.userAddress}`
    const resp = await fetch(
      uploadPreKeysUrl,
      {
        method: 'PUT',
        mode: 'cors',
        body: `${serializedPrekeys} ${prekeysSignature}`,
      }
    )

    if (resp.status === 201) {
      const store = this.indexedDBStore
      // enhancement: remove all local prekeys before save
      await store.save_prekeys(preKeys.concat(lastResortPrekey))
      if (this.isCryptoboxReady) {
        await this.box.load()
      }
      preKeysDidUpload()
      if (isRegister) {
        await this.databases.usersDB.updateUser(this.user, { status: USER_STATUS.OK })
        runInAction(() => {
          this.user.status = USER_STATUS.OK
        })
      }
    } else {
      storeLogger.error(resp.toString())
    }
  }

  public exportUser = async () => {
    const {
      sessionsDB,
      messagesDB,
    } = this.databases
    const data: IDumpedDatabases = {}
    const user = this.user
    data.keymail = [
      { table: 'users', rows: [user], },
      { table: 'sessions', rows: await sessionsDB.getSessions(user)},
      { table: 'messages', rows: await messagesDB.getMessagesOfUser(user)}
    ]
    const cryptobox = await dumpCryptobox(user)
    data[cryptobox.dbname] = cryptobox.tables
    downloadObjectAsJson(data, `keymail@${user.networkId}@${user.userAddress}`)
  }

  private async loadDataFromLocal() {
    const {
      user: {
        networkId,
        userAddress,
      }
    } = this
    const indexedDBStore = this.indexedDBStore = new IndexedDBStore(`${networkId}@${userAddress}`)
    const box = this.box = new Cryptobox(indexedDBStore as any, 0)

    await box.load()
    runInAction(() => {
      this.isCryptoboxReady = true
    })
  }
}

function generatePreKeys(start: number, interval: number, size: number) {
  return Array(size).fill(0)
    .map((_, x) => PreKey.new(((start + (x * interval)) % PreKey.MAX_PREKEY_ID)))
}

interface ICheckIdentityUploadStatusLifecycle {
  checkRegisterWillStart?: (hash: string) => void
  identityDidUpload?: () => void
  registerDidFail?: (err: Error | null, code?: REGISTER_FAIL_CODE) => void
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
  contacts: IContact[]

  lastFetchBlockOfMessages: number
  lastFetchBlockOfBroadcast: number
  lastFetchBlockOfBoundSocials: number

  boundSocials: IBoundSocials
  bindingSocials: IBindingSocials
}

export enum USER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADED = 1,
  OK = 2
}

export interface IContact {
  userAddress: string
  blockHash: string
}
