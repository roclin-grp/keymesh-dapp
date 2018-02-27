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
  UserCachesStore,
} from './UserCachesStore'
import {
  UserProofsStatesStore,
} from './UserProofsStatesStore'

import {
  keys as proteusKeys,
} from 'wire-webapp-proteus'

import {
  noop,
} from '../utils'
import {
  isHexZeroValue,
} from '../utils/hex'
import {
  getPublicKeyFingerPrint,
  generatePublicKeyFromHexStr,
} from '../utils/proteus'

import {
  getDatabases,
} from '../databases'
import {
  UsersDB,
  ICreateUserArgs,
} from '../databases/UsersDB'

import { sha3 } from '../utils/cryptos'

import IndexedDBStore from '../IndexedDBStore'

export class UsersStore {
  public static getAvatarHashByUser(user: IUser): string {
    switch (user.status) {
      case USER_STATUS.OK:
      case USER_STATUS.IDENTITY_UPLOADED:
        return sha3(`${user.userAddress}${user.blockHash}`)
      default:
        return ''
    }
  }

  @observable.ref public users: IUser[] = []
  @observable.ref public currentUserStore: UserStore | undefined
  @observable public isLoadingUsers = true
  @observable public hasRegisterRecordOnChain = false

  public userCachesStore: UserCachesStore
  public userProofsStatesStore: UserProofsStatesStore

  private usersDB: UsersDB
  private lastNetworkId: ETHEREUM_NETWORKS | undefined
  private cachedUserStores: {
    [userAddress: string]: UserStore,
  } = {}

  constructor(
    private metaMaskStore: MetaMaskStore,
    private contractStore: ContractStore,
  ) {
    this.usersDB = getDatabases().usersDB
    this.userCachesStore = new UserCachesStore(this, metaMaskStore)
    this.userProofsStatesStore = new UserProofsStatesStore({
      usersStore: this,
      contractStore: this.contractStore,
    })

    reaction(
      () => this.metaMaskStore.currentEthereumAccount,
      this.checkOnChainRegisterRecord,
    )

    reaction(
      () => ({
        isActive: this.metaMaskStore.isActive,
        networkId: this.metaMaskStore.currentEthereumNetwork,
      }),
      this.reloadUsersIfNetworkChanged,
    )
  }

  @computed
  public get usableUsers() {
    return this.users.filter((user) => user.status === USER_STATUS.OK)
  }

  @computed
  public get hasUser() {
    return this.currentUserStore != null
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
    return this.walletCorrespondingUser != null
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

    const identityKeyPair = proteusKeys.IdentityKeyPair.new()
    const userPublicKeyFingerprint = getPublicKeyFingerPrint(identityKeyPair.public_key)

    transactionWillCreate()
    identitiesContract.register(userPublicKeyFingerprint)
      .on('transactionHash', async (transactionHash) => {
        try {
          transactionDidCreate(transactionHash)
          // crytobox data
          const store = new IndexedDBStore(`${ethereumNetworkId}@${ethereumAddress}`)
          await store.save_identity(identityKeyPair)
          const lastResortPreKey = proteusKeys.PreKey.last_resort()
          await store.save_prekey(lastResortPreKey)

          const user = await this.createUser(
            {
              networkId: ethereumNetworkId,
              userAddress: ethereumAddress,
              identityTransactionHash: transactionHash,
            },
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
    const { usersDB } = this
    const user = await usersDB.getUser(networkId, userAddress)
    if (user != null) {
      await usersDB.deleteUser(user)
      if (this.metaMaskStore.currentEthereumNetwork === networkId) {
        this.removeUser(user)
      }
    }
  }

  public importUser = async (stringifyData: string) => {
    const user = await this.usersDB.restoreUserFromExportedData(
      this.metaMaskStore.currentEthereumNetwork!,
      JSON.parse(stringifyData),
    )
    runInAction(() => {
      this.addUser(user)
    })
    return user
  }

  public getAvatarHashByUserAddress = async (userAddress: string) => {
    const { blockNumber } = await this.getIdentityByUserAddress(userAddress)
    const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)
    return sha3(`${userAddress}${blockHash}`)
  }

  public getUserStore = (user: IUser): UserStore => {
    const oldStore = this.cachedUserStores[user.userAddress]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new UserStore(
      user,
      this.metaMaskStore,
      this.contractStore,
      this,
    )
    this.cachedUserStores[user.userAddress] = newStore
    return newStore
  }

  public disposeUserStore(user: IUser) {
    const oldStore = this.cachedUserStores[user.userAddress]
    if (oldStore == null) {
      return
    }

    delete this.cachedUserStores[user.userAddress]
  }

  public clearCachedStores() {
    this.cachedUserStores = {}
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
    if (this.hasUser) {
      this.currentUserStore!.disposeStore()
    }
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
    if (
      userAddress != null
      && this.metaMaskStore.isActive
      && !this.contractStore.isNotAvailable
    ) {
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
      isActive: boolean,
    }) => {
    if (!isActive || this.lastNetworkId === networkId ) {
      return
    }

    this.users = []
    this.clearCachedStores()
    this.isLoadingUsers = true

    const users = await this.usersDB.getUsers(networkId!)

    const userAddress = getNetworkLastUsedUserAddress(networkId!)
    let user: IUser | undefined
    if (userAddress !== '') {
      user = users.find((_user) => _user.userAddress === userAddress)
    }

    runInAction(() => {
      this.loadUsers(users)
      if (user != null) {
        this.useUser(user)
      }
      this.isLoadingUsers = false
    })
    this.lastNetworkId = networkId
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
  localStorage.setItem(`keymesh@${networkId}@last-used-user`, userAddress)
}

function getNetworkLastUsedUserAddress(networkId: ETHEREUM_NETWORKS) {
  return (localStorage.getItem(`keymesh@${networkId}@last-used-user`) || '').toString()
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
