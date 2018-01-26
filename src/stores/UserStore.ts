import {
  observable,
  computed,
  reaction,
  runInAction,
} from 'mobx'

import {
  sha3,
} from 'trustbase'

import {
  Cryptobox,
} from 'wire-webapp-cryptobox'

import {
  keys,
} from 'wire-webapp-proteus'

const sodium = require('libsodium-wrappers-sumo')

import {
  EthereumStore,
  ContractStore,
  SessionStore,
  UsersStore,
} from './'

import {
  REGISTER_FAIL_CODE
} from './UsersStore'

import {
  noop,
  isHexZeroValue,
  unixToday,
  storeLogger,
  dumpCryptobox,
  IdumpedDatabases,
  downloadObjectAsJson,
} from '../utils'

import {
  USER_STATUS,
} from '../constants'

import DB from '../DB'
import IndexedDBStore from '../IndexedDBStore'
import PreKeysPackage from '../PreKeysPackage'

import {
  Iuser,
  Isession,
  IcheckIdentityUploadStatusLifecycle,
  IuploadPreKeysLifecycle,
  IpreKeyPublicKeys,
} from '../../typings/interface'

const {
  IdentityKeyPair,
  PreKey,
} = keys

export class UserStore {
  @observable public user: Iuser
  @observable.ref public sessions: Isession[] = []
  @observable.ref public currentSession: SessionStore | undefined
  @observable public isDatabaseLoaded = false

  constructor(user: Iuser, {
    db,
    ethereumStore,
    contractStore,
    usersStore,
  }: {
    db: DB
    ethereumStore: EthereumStore
    contractStore: ContractStore
    usersStore: UsersStore
  }) {
    this.user = this.userRef = user
    this.db = db
    this.ethereumStore = ethereumStore
    this.contractStore = contractStore
    this.loadDataFromLocal()

    reaction(
      () => ({
        status: this.user.status,
        blockHash: this.user.blockHash,
        registerRecord: this.user.registerRecord,
      }) as Iuser,
      (observableUserData) => Object.assign(this.userRef, observableUserData))
  }

  @computed
  public get avatarHash() {
    return this.user.status === USER_STATUS.PENDING
      ? ''
      : sha3(`${this.user.userAddress}${this.user.blockHash}`)
  }

  private userRef: Iuser
  private db: DB
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
    }: IcheckIdentityUploadStatusLifecycle = {}
  ) => {
    const user = this.user
    if (user.status === USER_STATUS.IDENTITY_UPLOADED) {
      return identityDidUpload()
    }

    if (!user.registerRecord) {
      throw new Error('Register record not found')
    }

    const {
      web3,
      getBlockHash,
    } = this.ethereumStore
    const { identitiesContract } = this.contractStore
    const {
      networkId,
      userAddress,
      registerRecord: {
        identityTransactionHash,
        identity: keyPairHexString
      }
    } = user
    const identityKeyPair = IdentityKeyPair.deserialise(sodium.from_hex(keyPairHexString).buffer)

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
              await this.db.updateUserStatus(Object.assign({}, user, { blockHash }), USER_STATUS.IDENTITY_UPLOADED)
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

  public uploadPreKeys = async (
    {
      preKeysDidUpload = noop,
      preKeysUploadDidFail = noop
    }: IuploadPreKeysLifecycle = {}
  ) => {
    const interval = 1
    const preKeys = generatePreKeys(unixToday(), interval, 365)

    const preKeysPublicKeys: IpreKeyPublicKeys = preKeys.reduce(
      (result, preKey) => Object.assign(result, {
        [preKey.key_id]: `0x${preKey.key_pair.public_key.fingerprint()}`
      }),
      {}
    )

    // use last pre-key as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const preKeysPackage = new PreKeysPackage(preKeysPublicKeys, interval, lastPreKey.key_id)
    const serializedPrekeys = `0x${sodium.to_hex(new Uint8Array(preKeysPackage.serialise()))}`
    const prekeysSignature = `0x${sodium.to_hex(this.box.identity.secret_key.sign(serializedPrekeys))}`

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
      await this.box.load()
      preKeysDidUpload()
    } else {
      storeLogger.error(resp.toString())
    }
  }

  public updateUserStatusToOK = async () => {
    await this.db.updateUserStatus(this.user, USER_STATUS.OK)
    runInAction(() => {
      this.user.status = USER_STATUS.OK
      delete this.user.registerRecord
    })
  }

  public exportUser = async () => {
    const data: IdumpedDatabases = {}
    const user = this.user
    const sessions = this.sessions
    const messages = await this.db.getUserMessages(user)
    data.keymail = [
      { table: 'users', rows: [user], },
      { table: 'sessions', rows: sessions},
      { table: 'messages', rows: messages}
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
      },
      user,
      db
    } = this
    const indexedDBStore = this.indexedDBStore = new IndexedDBStore(`${networkId}@${userAddress}`)
    const box = this.box = new Cryptobox(indexedDBStore as any, 0)
    await box.load()

    const sessions = await db.getSessions(user)
    runInAction(() => {
      this.isDatabaseLoaded = true
      delete this.currentSession
      this.sessions = sessions
      this.box = box
      this.indexedDBStore = indexedDBStore
    })
  }
}

function generatePreKeys(start: number, interval: number, size: number) {
  return Array(size).fill(0)
    .map((_, x) => PreKey.new(((start + (x * interval)) % PreKey.MAX_PREKEY_ID)))
}
