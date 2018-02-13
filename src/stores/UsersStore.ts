import {
  observable,
  action,
  computed,
  reaction,
  runInAction,
} from 'mobx'
import {
  MetaMaskStore,
  ETHEREUM_NETWORKS,
} from './MetaMaskStore'
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
  isHexZeroValue,
} from '../utils/hex'
import {
  getPublicKeyFingerPrint,
} from '../utils/proteus'

import {
  getDatabases,
} from '../databases'
import {
  UsersDB,
  ICreateUserArgs,
} from '../databases/UsersDB'
import { sha3 } from 'trustbase'

import IndexedDBStore from '../IndexedDBStore'
import { generatePublicKeyFromHexStr } from '../utils/proteus'
import { UserCachesStore } from './UserCachesStore'

export class UsersStore {
  @observable.ref public users: IUser[] = []
  @observable.ref public currentUserStore: UserStore | undefined
  @observable public isLoadingUsers = true
  @observable public hasRegisterRecordOnChain = false

  @computed
  public get usableUsers() {
    return this.users.filter((user) => user.status === USER_STATUS.OK)
  }

  @computed
  public get hasUser() {
    return typeof this.currentUserStore !== 'undefined'
  }

  @computed
  public get walletCorrespondingUser() {
    const {
      currentEthereumAccount,
    } = this.metaMaskStore
    return this.usableUsers.find((user) => user.userAddress === currentEthereumAccount)
  }

  @computed
  public get hasWalletCorrespondingUsableUser() {
    return typeof this.walletCorrespondingUser !== 'undefined'
  }

  @computed
  public get hasRegisterRecordOnLocal() {
    const {
      isActive,
      currentEthereumAccount,
    } = this.metaMaskStore
    return isActive
      && (this.users.findIndex((user) => user.userAddress === currentEthereumAccount) !== -1)
  }

  public userCachesStore: UserCachesStore

  constructor({
    metaMaskStore,
    contractStore,
  }: {
    metaMaskStore: MetaMaskStore
    contractStore: ContractStore
  }) {
    this.usersDB = getDatabases().usersDB
    this.metaMaskStore = metaMaskStore
    this.contractStore = contractStore
    this.userCachesStore = new UserCachesStore({
      usersStore: this,
      metaMaskStore,
    })

    reaction(
      () => this.metaMaskStore.currentEthereumAccount,
      this.checkOnChainRegisterRecord
    )

    reaction(
      () => ({
        isActive: this.metaMaskStore.isActive,
        networkId: this.metaMaskStore.currentEthereumNetwork,
      }),
      this.reloadUsersIfNetworkChanged
    )
  }

  private usersDB: UsersDB
  private metaMaskStore: MetaMaskStore
  private contractStore: ContractStore
  private lastNetworkId: ETHEREUM_NETWORKS | undefined
  private cachedUserStores: {
    [primaryKey: string]: UserStore
  } = {}

  public static getAvatarHashByUser(user: IUser): string {
    switch (user.status) {
      case USER_STATUS.OK:
      case USER_STATUS.IDENTITY_UPLOADED:
        return sha3(`${user.userAddress}${user.blockHash}`)
      default:
        return ''
    }
  }

  public async getUserPublicKey(userAddress: string) {
    if (userAddress === '') {
      return undefined
    }

    const {
      publicKey: identityFingerprint,
    } = await this.getIdentityByUserAddress(userAddress)
    if (isHexZeroValue(identityFingerprint)) {
      return undefined
    }

    return generatePublicKeyFromHexStr(identityFingerprint)
  }

  public getIdentityByUserAddress(userAddress: string) {
    return this.contractStore.identitiesContract.getIdentity(userAddress)
  }

  public register = async ({
    transactionWillCreate = noop,
    transactionDidCreate = noop,
    userDidCreate = noop,
    registerDidFail = noop,
  }: IRegisterLifecycle = {}) => {
    // enviorment
    const ethereumAddress = this.metaMaskStore.currentEthereumAccount!
    const ethereumNetworkId = this.metaMaskStore.currentEthereumNetwork!
    const identitiesContract = this.contractStore.identitiesContract

    // check if registered, avoid unnecessary transaction
    const {
      publicKey,
    } = await this.getIdentityByUserAddress(ethereumAddress)
    if (!isHexZeroValue(publicKey)) {
      if (ethereumAddress === this.metaMaskStore.currentEthereumAccount) {
        runInAction(() => {
          this.hasRegisterRecordOnChain = true
        })
      }
      registerDidFail(null, REGISTER_FAIL_CODE.OCCUPIED)
      return
    }

    const identityKeyPair = IdentityKeyPair.new()
    const userPublicKeyFingerprint = getPublicKeyFingerPrint(identityKeyPair.public_key)

    transactionWillCreate()
    identitiesContract.register(userPublicKeyFingerprint)
      .on('transactionHash', async (transactionHash) => {
        try {
          transactionDidCreate(transactionHash)
          // crytobox data
          const store = new IndexedDBStore(`${ethereumNetworkId}@${ethereumAddress}`)
          await store.save_identity(identityKeyPair)
          await store.save_prekey(PreKey.last_resort())

          const user = await this.createUser(
            {
              networkId: ethereumNetworkId,
              userAddress: ethereumAddress,
              identityTransactionHash: transactionHash,
            }
          )
          userDidCreate(user)
        } catch (err) {
          registerDidFail(err)
        }
      })
      .on('error', async (err) => {
        if (err.message.includes('Transaction was not mined within 50 blocks')) {
          // we don't care here
          // we handle timeout in UserStore.checkIdentityUploadStatus
          return
        }
        try {
          await this.deleteUser(ethereumNetworkId, ethereumAddress)
        } finally {
          registerDidFail(err)
        }
      })
  }

  public deleteUser = async (networkId: ETHEREUM_NETWORKS, userAddress: string) => {
    const {usersDB} = this
    const user = await usersDB.getUser(networkId, userAddress)
    if (typeof user !== 'undefined') {
      await usersDB.deleteUser(user)
      if (this.metaMaskStore.currentEthereumNetwork === networkId) {
        this.removeUser(user)
      }
    }
  }

  public importUser = async (stringifyData: string) => {
    const user = await this.usersDB.restoreUserFromExportedData(
      this.metaMaskStore.currentEthereumNetwork!,
      JSON.parse(stringifyData)
    )
    runInAction(() => {
      this.addUser(user)
    })
    return user
  }

  public getAvatarHashByUserAddress = async (userAddress: string) => {
    const {
      getBlockHash,
    } = this.metaMaskStore
    const { blockNumber } = await this.getIdentityByUserAddress(userAddress)
    const blockHash = await getBlockHash(blockNumber)
    return sha3(`${userAddress}${blockHash}`)
  }

  public getUserStore = (user: IUser): UserStore => {
    const primaryKey = `${user.networkId}${user.userAddress}`
    let store = this.cachedUserStores[primaryKey]
    if (typeof store === 'undefined') {
      store = new UserStore(user, {
        metaMaskStore: this.metaMaskStore,
        contractStore: this.contractStore,
        usersStore: this,
      })
      this.cachedUserStores[primaryKey] = store
    }
    return store
  }

  public isCurrentUser = (networkId: ETHEREUM_NETWORKS, userAddress: string) => {
    return (
      this.hasUser
      && this.currentUserStore!.user.networkId === networkId
      && this.currentUserStore!.user.userAddress === userAddress
    )
  }

  @action
  public useUser = (user: IUser) => {
    const userStore = this.getUserStore(user)
    this.currentUserStore = userStore
    setNetworkLastUsedUserAddress(user)
  }

  private createUser = async (args: ICreateUserArgs) => {
    const user = await this.usersDB.createUser(args)

    this.addUser(user)

    return user
  }

  private checkOnChainRegisterRecord = async (userAddress?: string) => {
    if (typeof userAddress !== 'undefined' && !this.contractStore.isNotAvailable) {
      const {
        publicKey,
      } = await this.getIdentityByUserAddress(userAddress)

      if (userAddress === this.metaMaskStore.currentEthereumAccount) {
        runInAction(() => {
          this.hasRegisterRecordOnChain = !isHexZeroValue(publicKey)
        })
      }
    }
  }

  private reloadUsersIfNetworkChanged = async ({
    networkId,
    isActive,
  }: {
    networkId: ETHEREUM_NETWORKS | undefined,
    isActive: Boolean,
  }) => {
    if (
      isActive
      && this.lastNetworkId !== networkId
    ) {
      this.isLoadingUsers = true

      this.cachedUserStores = {}
      const users = await this.usersDB.getUsers(networkId!)

      const userAddress = getNetworkLastUsedUserAddress(networkId!)
      let user: IUser | undefined
      if (userAddress !== '') {
        user = users.find((_user) => _user.userAddress === userAddress)
      }

      runInAction(() => {
        this.loadUsers(users)
        if (typeof user !== 'undefined') {
          this.useUser(user)
        }
        this.isLoadingUsers = false
      })
      this.lastNetworkId = networkId
    }
  }

  @action
  private loadUsers = (users: IUser[]) => {
    this.users = users
    this.unsetUser()
  }

  @action
  private addUser = (user: IUser) => {
    // we should ideally prepend the new user to the list
    // this.users = [user].concat(this.users)
    // but `key` props are not preserved in antd list
    //
    // tslint:disable-next-line
    // See: https://github.com/facebook/react/blob/087c48bb36b88ef0b5bbca2b9b70a52d8d413102/packages/react/src/ReactChildren.js#L307
    this.users = this.users.concat(user)
  }

  @action
  private removeUser = (user: IUser) => {
    this.users = this.users.filter((_user) => _user.userAddress !== user.userAddress)

    if (this.isCurrentUser(user.networkId, user.userAddress)) {
      this.unsetUser()
    }
  }

  @action
  private unsetUser = () => {
    this.currentUserStore = undefined
  }
}

function setNetworkLastUsedUserAddress({
  networkId,
  userAddress,
}: IUser) {
  localStorage.setItem(`keymail@${networkId}@last-used-user`, userAddress)
}

function getNetworkLastUsedUserAddress(networkId: ETHEREUM_NETWORKS) {
  return (localStorage.getItem(`keymail@${networkId}@last-used-user`) || '').toString()
}

export enum REGISTER_FAIL_CODE {
  UNKNOWN = 0,
  OCCUPIED,
  TRANSACTION_ERROR,
}

interface IRegisterLifecycle extends ITransactionLifecycle {
  userDidCreate?: (user: IUser) => void
  registerDidFail?: (err: Error | null, code?: REGISTER_FAIL_CODE) => void
}
