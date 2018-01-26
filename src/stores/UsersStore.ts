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

import {
  EthereumStore,
  ContractStore,
  UserStore,
} from './'

import {
  noop,
  storeLogger,
  isHexZeroValue,
} from '../utils'

import {
  ETHEREUM_NETWORKS,
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
        isActive: this.ethereumStore.isActive,
        networkId: this.ethereumStore.currentEthereumNetwork
      }),
      async ({
        networkId,
        isActive
      }) => {
        if (
          isActive
          && this.lastNetworkId !== networkId
        ) {
          this.isLoadingData = true
          const users = await db.getUsers(networkId!)

          let userAddress = getNetworkLastUsedUserAddress(networkId!)
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
            this.isLoadingData = false
          })
          this.lastNetworkId = networkId
        }
      }
    )
  }

  private db: DB
  private ethereumStore: EthereumStore
  private contractStore: ContractStore
  private lastNetworkId: ETHEREUM_NETWORKS | undefined
  @observable private isLoadingData = false

  @computed
  public get canCreateOrImportUser() {
    const {
      isActive,
      currentEthereumAccount,
    } = this.ethereumStore
    return isActive
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

  public deleteUser = async (networkId: ETHEREUM_NETWORKS, userAddress: string) => {
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

  public importUser = async (data: string, shouldRefreshSessions: boolean) => {
    await this.db.restoreUserFromExportedData(data)
    // todo
    // const oldUsers = this.currentNetworkUsers
    // if (users.length > 0) {
    //   runInAction(() => {
    //     this.currentNetworkUsers = users
    //   })
    //   if (oldUsers.length > 0) {
    //     const userAddresses = oldUsers.reduce(
    //       (result, user) => {
    //         result[user.userAddress] = true
    //         return result
    //       },
    //       {} as {[userAddress: string]: boolean}
    //     )
    //     const newUser = users.find((user) => !userAddresses[user.userAddress])
    //     if (newUser && newUser.networkId === currentNetworkId) {
    //       // await this.useUser(newUser, shouldRefreshSessions)
    //       if (shouldRefreshSessions) {
    //         return this.startFetchMessages()
    //       }
    //     }
    //   } else {
    //     const newUser = users[0]
    //     if (newUser.networkId === currentNetworkId) {
    //       // await this.useUser(newUser, shouldRefreshSessions)
    //       if (shouldRefreshSessions) {
    //         return this.startFetchMessages()
    //       }
    //     }
    //   }
    // }
  }

  public getAvatarHashByUserAddress = async (userAddress: string) => {
    //
  }

  @action
  private useUser = (user: Iuser) => {
    this.currentUserStore = new UserStore(user, {
      db: this.db,
      ethereumStore: this.ethereumStore,
      contractStore: this.contractStore,
      usersStore: this
    })
    setNetworkLastUsedUserAddress(user)
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

function setNetworkLastUsedUserAddress({
  networkId,
  userAddress
}: Iuser) {
  localStorage.setItem(`keymail@'${networkId}@last-used-user`, userAddress)
}

function getNetworkLastUsedUserAddress(networkId: ETHEREUM_NETWORKS) {
  return (localStorage.getItem(`keymail@'${networkId}@last-used-user`) || '').toString()
}

export enum REGISTER_FAIL_CODE {
  UNKNOWN = 0,
  OCCUPIED = 400,
  TIMEOUT = 500,
}
