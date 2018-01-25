import {
  observable,
  action,
  computed,
  reaction,
  runInAction,
} from 'mobx'

import {
  keys,
} from 'wire-webapp-proteus'

import { EthereumStore } from './EthereumStore'
import { ContractStore } from './ContractStore'
import { UserStore } from './UserStore'

import {
  noop,
  storeLogger,
  isHexZeroValue,
  setNetworkLastUsedUserAddress,
  getNetworkLastUsedUserAddress,
} from '../utils'

import {
  ETHEREUM_CONNECT_STATUS,
  NETWORKS,
  REGISTER_FAIL_CODE,
} from '../constants'

import DB from '../DB'
import IndexedDBStore from '../IndexedDBStore'

import {
  Iuser,
  IregisterLifecycle,
} from '../../typings/interface'

const sodium = require('libsodium-wrappers-sumo')

const {
  IdentityKeyPair,
  PreKey,
} = keys

export class UsersStore {
  @observable.ref public users: Iuser[] = []
  @observable.ref public currentUserStore: UserStore | undefined

  @computed
  public get hasUser() {
    return typeof this.currentUserStore !== 'undefined'
  }

  constructor({
    db,
    ethereumStore,
    contractStore,
  }: {
    db: DB
    ethereumStore: EthereumStore
    contractStore: ContractStore
  }) {
    this.db = db
    this.ethereumStore = ethereumStore
    this.contractStore = contractStore
    reaction(
      () => ({
        connectStatus: this.ethereumStore.ethereumConnectStatus,
        networkId: this.ethereumStore.currentEthereumNetwork
      }),
      async ({
        networkId,
        connectStatus
      }) => {
        if (
          connectStatus === ETHEREUM_CONNECT_STATUS.SUCCESS
          && typeof networkId !== 'undefined'
          && this.lastNetworkId !== networkId
        ) {
          this.isLoadingData = true
          const users = await db.getUsers(networkId)

          let userAddress = getNetworkLastUsedUserAddress(networkId)
          let user: Iuser | undefined
          if (userAddress !== '') {
            user = users.find((_user) => _user.userAddress === userAddress)
          }
          if (typeof user === 'undefined' && users.length > 0) {
            user = users[0]
          }

          runInAction(() => {
            this.loadUsers(users)
            if (typeof user !== 'undefined') {
              if (typeof this.currentUserStore === 'undefined') {
                this.useUser(user)
              } else {
                this.switchUser(user)
              }
            }
          })
          this.lastNetworkId = networkId
          this.isLoadingData = false
        }
      }
    )
  }

  private db: DB
  private ethereumStore: EthereumStore
  private contractStore: ContractStore
  private lastNetworkId: NETWORKS | undefined
  private isLoadingData = false

  @computed
  public get canCreateOrImportUser() {
    const {
      ethereumConnectStatus,
      currentEthereumAccount,
    } = this.ethereumStore
    return ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.SUCCESS
      && !this.isLoadingData
      && (this.users.findIndex((user) => user.userAddress === currentEthereumAccount) === -1)
  }

  public register = async ({
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    registerDidFail = noop
  }: IregisterLifecycle = {}) => new Promise(async (resolve, reject) => {
    if (!this.canCreateOrImportUser) {
      storeLogger.error(new Error('BUG: Trying to invoke `register` when it should not be invoked'))
      return
    }

    // cache enviorment
    const ethereumAddress = this.ethereumStore.currentEthereumAccount!
    const ethereumNetworkId = this.ethereumStore.currentEthereumNetwork!
    const identitiesContract = this.contractStore.identitiesContract

    // check if registered, avoid unnecessary transaction
    const {
      publicKey
    } = await identitiesContract.getIdentity(ethereumAddress)
    if (!isHexZeroValue(publicKey)) {
      return registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
    }

    const identityKeyPair = IdentityKeyPair.new()
    const userPublicKey = `0x${identityKeyPair.public_key.fingerprint()}`

    transactionWillCreate()
    identitiesContract.register(userPublicKey)
      .on('transactionHash', async (transactionHash) => {
        try {
          transactionDidCreate(transactionHash)
          // crytobox data
          const store = new IndexedDBStore(`${ethereumNetworkId}@${ethereumAddress}`)
          await store.save_identity(identityKeyPair)
          await store.save_prekeys([PreKey.last_resort()])

          const user = await this.db.createUser(
            {
              networkId: ethereumNetworkId,
              userAddress: ethereumAddress
            },
            {
              identityTransactionHash: transactionHash,
              identity: sodium.to_hex(new Uint8Array(identityKeyPair.serialise()))
            }
          )

          runInAction(() => {
            this.addUser(user)
            this.useUser(user)
          })
          resolve()
        } catch (err) {
          reject(err)
        }
      })
      .on('error', async (err) => {
        try {
          this.deleteUser(ethereumNetworkId, ethereumAddress)
        } finally {
          reject(err)
        }
      })
  }).catch(registerDidFail)

  public deleteUser = async (networkId: NETWORKS, userAddress: string) => {
    const user = await this.db.getUser(networkId, userAddress)
    if (typeof user !== 'undefined') {
      await this.db.deleteUser(user)
      if (this.ethereumStore.currentEthereumNetwork === networkId) {
        if (
          typeof this.currentUserStore !== 'undefined'
          && this.currentUserStore.user.userAddress === userAddress
        ) {
          this.removeCurrentUser()
        } else {
          this.removeUser(user)
        }
      }
    }
  }

  public switchUser = (user: Iuser) => {
    setNetworkLastUsedUserAddress(user)
    window.location.reload()
  }

  @action
  private useUser = (user: Iuser) => {
    this.currentUserStore = new UserStore(user, {
      db: this.db,
      ethereumStore: this.ethereumStore,
      contractStore: this.contractStore,
      usersStore: this
    })
  }

  @action
  private loadUsers = (users: Iuser[]) => {
    this.users = users
    this.unsetUser()
  }

  @action
  private addUser = (user: Iuser) => {
    this.users = this.users.concat(user)
  }

  @action
  private removeUser = (user: Iuser) => {
    this.users = this.users.filter((_user) => _user.userAddress !== user.userAddress)
  }

  @action
  private removeCurrentUser = () => {
    this.removeUser(this.currentUserStore!.user)
    this.unsetUser()

    const remainUsers = this.users
    if (remainUsers.length > 0) {
      this.useUser(remainUsers[0])
    }
  }

  @action
  private unsetUser = () => {
    delete this.currentUserStore
  }
}
