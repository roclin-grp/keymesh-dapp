import {
  observable,
  action,
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
  ITransactionLifecycle,
} from './ContractStore'
import {
  UserStore,
  IUser,
  USER_STATUS,
} from './UserStore'

import {
  keys,
} from 'wire-webapp-proteus'
const {
  IdentityKeyPair,
  PreKey,
} = keys

import {
  noop,
} from '../utils'
import {
  storeLogger,
} from '../utils/loggers'
import {
  isHexZeroValue
} from '../utils/hex'

import {
  Databases,
} from '../databases'

import IndexedDBStore from '../IndexedDBStore'
import { generatePublicKeyFromHexStr } from '../utils/proteus'

export class UsersStore {
  @observable.ref public users: IUser[] = []
  @observable.ref public currentUserStore: UserStore | undefined
  @observable public isLoadingUsers = true
  @observable public hasNoRegisterRecordOnChain = false

  @computed
  public get usableUsers() {
    return this.users.filter((user) => user.status === USER_STATUS.OK)
  }

  @computed
  public get hasUser() {
    return typeof this.currentUserStore !== 'undefined'
  }

  @computed
  public get hasWalletCorrespondingUsableUser() {
    const {
      currentEthereumAccount
    } = this.ethereumStore
    return typeof this.usableUsers.find((user) => user.userAddress === currentEthereumAccount) !== 'undefined'
  }

  @computed
  public get hasNoRegisterRecordOnLocal() {
    const {
      isActive,
      currentEthereumAccount,
    } = this.ethereumStore
    return isActive
      && (this.users.findIndex((user) => user.userAddress === currentEthereumAccount) === -1)
  }

  constructor({
    databases,
    ethereumStore,
    contractStore,
  }: {
    databases: Databases
    ethereumStore: EthereumStore
    contractStore: ContractStore
  }) {
    this.databases = databases
    this.ethereumStore = ethereumStore
    this.contractStore = contractStore

    reaction(
      () => this.ethereumStore.currentEthereumAccount,
      this.checkChainRegisterRecordByUserAddress
    )

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
          this.isLoadingUsers = true
          const users = await databases.usersDB.getUsers(networkId!)

          let userAddress = getNetworkLastUsedUserAddress(networkId!)
          let user: IUser | undefined
          if (userAddress !== '') {
            user = users.find((_user) => _user.userAddress === userAddress)
          }
          // if (typeof user === 'undefined' && this.usableUsers.length > 0) {
          //   user = this.usableUsers[0]
          // }

          runInAction(() => {
            this.loadUsers(users)
            if (typeof user !== 'undefined') {
              if (typeof this.currentUserStore === 'undefined') {
                this.useUser(user)
              } else {
                this.switchUser(user)
              }
            }
            this.isLoadingUsers = false
          })
          this.lastNetworkId = networkId
        }
      }
    )
  }

  private databases: Databases
  private ethereumStore: EthereumStore
  private contractStore: ContractStore
  private lastNetworkId: ETHEREUM_NETWORKS | undefined

  public async getUserPublicKey(userAddress: string) {
    if (userAddress === '') {
      return undefined
    }

    const {
      publicKey: identityFingerprint
    } = await this.getIdentity(userAddress)
    if (Number(identityFingerprint) === 0) {
      return undefined
    }

    return generatePublicKeyFromHexStr(identityFingerprint.slice(2))
  }

  public getIdentity(userAddress: string) {
    return this.contractStore.identitiesContract.getIdentity(userAddress)
  }

  public register = async ({
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    registerDidFail = noop
  }: IRegisterLifecycle = {}) => new Promise(async (resolve, reject) => {
    if (!this.hasNoRegisterRecordOnLocal) {
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
    } = await this.getIdentity(ethereumAddress)
    if (!isHexZeroValue(publicKey)) {
      if (ethereumAddress === this.ethereumStore.currentEthereumAccount) {
        runInAction(() => {
          this.hasNoRegisterRecordOnChain = false
        })
      }
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
          await store.save_prekey(PreKey.last_resort())

          const user = await this.databases.usersDB.createUser(
            {
              networkId: ethereumNetworkId,
              userAddress: ethereumAddress,
              identityTransactionHash: transactionHash
            }
          )

          runInAction(() => {
            this.addUser(user)
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
    const {usersDB} = this.databases
    const user = await usersDB.getUser(networkId, userAddress)
    if (typeof user !== 'undefined') {
      await usersDB.deleteUser(user)
      if (this.ethereumStore.currentEthereumNetwork === networkId) {
        this.removeUser(user)
      }
    }
  }

  public switchUser = (user: IUser) => {
    setNetworkLastUsedUserAddress(user)
    window.location.reload()
  }

  public importUser = async (stringifyData: string) => {
    const user = await this.databases.usersDB.restoreUserFromExportedData(
      this.ethereumStore.currentEthereumNetwork!,
      JSON.parse(stringifyData)
    )
    runInAction(() => {
      this.addUser(user)
      this.useUser(user)
    })
  }

  public getAvatarHashByUserAddress = async (userAddress: string) => {
    //
  }

  public createUserStore = (user: IUser) => {
    return new UserStore(user, {
      databases: this.databases,
      ethereumStore: this.ethereumStore,
      contractStore: this.contractStore,
      usersStore: this
    })
  }

  public isCurrentUser = (user: IUser) => {
    return this.hasUser && this.currentUserStore!.user.userAddress === user.userAddress
  }

  @action
  public useUser = (user: IUser) => {
    this.currentUserStore = this.createUserStore(user)
    setNetworkLastUsedUserAddress(user)
  }

  private checkChainRegisterRecordByUserAddress = async (userAddress: string) => {
    if (typeof userAddress !== 'undefined') {
      const {
        publicKey
      } = await this.contractStore.identitiesContract.getIdentity(userAddress)

      runInAction(() => {
        this.hasNoRegisterRecordOnChain = isHexZeroValue(publicKey)
      })
    }
  }

  @action
  private loadUsers = (users: IUser[]) => {
    this.users = users
    this.unsetUser()
  }

  @action
  private addUser = (user: IUser) => {
    this.users = this.users.concat(user)
  }

  @action
  private removeUser = (user: IUser) => {
    // const remainUsers =
    this.users = this.users.filter((_user) => _user.userAddress !== user.userAddress)

    if (
      this.hasUser
      && this.currentUserStore!.user.userAddress === user.userAddress
    ) {
      this.unsetUser()
      // if (remainUsers.length > 0) {
      //   this.useUser(remainUsers[0])
      // }
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
}: IUser) {
  localStorage.setItem(`keymail@'${networkId}@last-used-user`, userAddress)
}

function getNetworkLastUsedUserAddress(networkId: ETHEREUM_NETWORKS) {
  return (localStorage.getItem(`keymail@'${networkId}@last-used-user`) || '').toString()
}

interface IRegisterLifecycle extends ITransactionLifecycle {
  registerDidFail?: (err: Error | null, code?: REGISTER_FAIL_CODE) => void
}

export enum REGISTER_FAIL_CODE {
  UNKNOWN = 0,
  OCCUPIED = 400,
  TIMEOUT = 500,
}
