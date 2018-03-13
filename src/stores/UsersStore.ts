import {
  observable,
  action,
  computed,
  reaction,
  runInAction,
  observe,
  IValueDidChange,
} from 'mobx'
import { keys as proteusKeys } from 'wire-webapp-proteus'

import { MetaMaskStore, ETHEREUM_NETWORKS } from './MetaMaskStore'
import { ContractStore } from './ContractStore'
import {
  UserStore,
  IUser,
  USER_STATUS,
  getCryptoBoxIndexedDBName,
} from './UserStore'
import { UserCachesStore } from './UserCachesStore'
import { UserProofsStatesStore } from './UserProofsStatesStore'

import { isHexZeroValue } from '../utils/hex'
import { getPublicKeyFingerPrint, publicKeyFromHexStr } from '../utils/proteus'
import { sha3, isAddress } from '../utils/cryptos'
import { transactionPromiEventToPromise } from '../utils/transaction'

import { getDatabases } from '../databases'
import { UsersDB, ICreateUserArgs } from '../databases/UsersDB'

import IndexedDBStore from '../IndexedDBStore'

export class UsersStore {
  @observable.ref public users: IUser[] = []
  @observable.ref public currentUserStore: UserStore | undefined
  @observable public isLoadingUsers = true
  @observable public isCheckingRegisterRecord = true
  @observable public hasRegisterRecordOnChain = false
  // FIXME: move to outside
  public readonly userCachesStore: UserCachesStore
  // FIXME: move to outside
  public readonly userProofsStatesStore: UserProofsStatesStore

  private readonly cachedUserStores: { [userAddress: string]: UserStore } = {}
  private readonly usersDB: UsersDB

  constructor(
    private readonly metaMaskStore: MetaMaskStore,
    private readonly contractStore: ContractStore,
  ) {
    this.usersDB = getDatabases().usersDB

    // FIXME: move to outside
    this.userCachesStore = new UserCachesStore(this, metaMaskStore)
    // FIXME: move to outside
    this.userProofsStatesStore = new UserProofsStatesStore({
      usersStore: this,
      contractStore: this.contractStore,
    })

    reaction(
      () => ({
        currentEthereumAccount: metaMaskStore.currentEthereumAccount,
        hasWalletCorrespondingAvailableUser: this.hasWalletCorrespondingAvailableUser,
        isContractAvailable: contractStore.isAvailable,
      }),
      ({ currentEthereumAccount }) => this.checkOnChainRegisterRecord(currentEthereumAccount),
    )

    observe(
      metaMaskStore,
      'currentEthereumNetwork',
      ({
        oldValue,
        newValue,
      }: IValueDidChange<MetaMaskStore['currentEthereumNetwork']>) =>
        this.reloadUsersIfNetworkChanged(newValue, oldValue),
    )
  }

  @computed
  public get usableUsers(): IUser[] {
    return this.users.filter((user) => user.status === USER_STATUS.OK)
  }

  @computed
  public get hasUser(): boolean {
    return this.currentUserStore != null
  }

  @computed
  public get walletCorrespondingAvailableUser(): IUser | undefined {
    const { walletCorrespondingUser } = this
    if (
      walletCorrespondingUser == null ||
      walletCorrespondingUser.status !== USER_STATUS.OK
    ) {
      return
    }
    return walletCorrespondingUser
  }

  @computed
  public get hasWalletCorrespondingAvailableUser(): boolean {
    return this.walletCorrespondingAvailableUser != null
  }

  @computed
  public get walletCorrespondingUser(): IUser | undefined {
    const { currentEthereumAccount } = this.metaMaskStore
    return this.users.find(
      (user) => user.userAddress === currentEthereumAccount,
    )
  }

  @computed
  public get hasRegisterRecordOnLocal(): boolean {
    return this.walletCorrespondingUser != null
  }

  @computed
  public get walletCorrespondingUserStore(): UserStore | undefined {
    const { walletCorrespondingUser } = this
    return walletCorrespondingUser && this.getUserStore(walletCorrespondingUser)
  }

  // TODO: remove this
  public getIdentityByUserAddress(userAddress: string) {
    return this.contractStore.identitiesContract.getIdentity(userAddress)
  }

  public async register() {
    const { identitiesContract, isAvailable } = this.contractStore
    if (!isAvailable) {
      throw new Error('Contract not available')
    }

    const ethereumNetworkId = this.metaMaskStore.networkID
    const ethereumAddress = this.metaMaskStore.walletAddress

    const identityKeyPair = proteusKeys.IdentityKeyPair.new()
    const userPublicKeyFingerprint = getPublicKeyFingerPrint(
      identityKeyPair.public_key,
    )

    const promiEvent = identitiesContract.register(userPublicKeyFingerprint)
    const transactionHash = await transactionPromiEventToPromise(promiEvent)

    // create crytobox data
    const store = new IndexedDBStore(`${ethereumNetworkId}@${ethereumAddress}`)
    await store.save_identity(identityKeyPair)
    const lastResortPreKey = proteusKeys.PreKey.last_resort()
    await store.save_prekey(lastResortPreKey)

    await this.createUser({
      networkId: ethereumNetworkId,
      userAddress: ethereumAddress,
      identityTransactionHash: transactionHash,
    })
  }

  public async deleteUser(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    const { usersDB } = this
    const user = await usersDB.getUser(networkId, userAddress)
    if (user == null) {
      return
    }

    await usersDB.deleteUser(user)
    const dbName = getCryptoBoxIndexedDBName(user)
    const indexedDBStore = new IndexedDBStore(dbName)
    await indexedDBStore.delete_all()
    if (this.metaMaskStore.currentEthereumNetwork === networkId) {
      this.removeUser(user)
    }
  }

  public async importUser(stringifyData: string): Promise<IUser> {
    const user = await this.usersDB.restoreUserFromExportedData(
      this.metaMaskStore.currentEthereumNetwork!,
      JSON.parse(stringifyData),
    )
    this.addUser(user)
    return user
  }

  public getUserStore(user: IUser): UserStore {
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

  public removeCachedUserStore(userStore: UserStore) {
    delete this.cachedUserStores[userStore.user.userAddress]
  }

  /**
   * dispose all cached sub-stores
   */
  public clearCachedUserStores() {
    for (const userStore of Object.values(this.cachedUserStores)) {
      userStore.disposeStore()
    }
  }

  public isCurrentUser(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return (
      this.hasUser &&
      this.currentUserStore!.user.networkId === networkId &&
      this.currentUserStore!.user.userAddress === userAddress
    )
  }

  @action
  public useUser(user: IUser) {
    if (this.currentUserStore != null) {
      this.currentUserStore.disposeStore()
    }

    const userStore = this.getUserStore(user)
    this.currentUserStore = userStore
    userStore.chatMessagesCenter.startFetchMessages()

    // save record to local storage
    setNetworkLastUsedUserAddress(user)
  }

  private async createUser(args: ICreateUserArgs): Promise<IUser> {
    const user = await this.usersDB.createUser(args)

    this.addUser(user)

    return user
  }

  private async checkOnChainRegisterRecord(userAddress?: string) {
    this.setIsCheckingRegisterRecord(true)
    if (
      !this.metaMaskStore.isActive ||
      userAddress == null ||
      !this.contractStore.isAvailable
    ) {
      this.setIsCheckingRegisterRecord(false)
      return
    }

    if (this.hasWalletCorrespondingAvailableUser) {
      this.setHasRegisterRecordOnChain(userAddress, true)
      return
    }

    const {
      publicKey,
    } = await this.contractStore.identitiesContract.getIdentity(userAddress)

    const hasRegisterRecordOnChain = !isHexZeroValue(publicKey)
    // TODO: disable existed local user if public key has changed
    this.setHasRegisterRecordOnChain(userAddress, hasRegisterRecordOnChain)
  }

  @action
  private setIsCheckingRegisterRecord(value: boolean) {
    this.isCheckingRegisterRecord = value
  }

  @action
  private setHasRegisterRecordOnChain(userAddress: string, value: boolean) {
    if (userAddress !== this.metaMaskStore.currentEthereumAccount) {
      return
    }

    this.hasRegisterRecordOnChain = value
    this.setIsCheckingRegisterRecord(false)
  }

  private async reloadUsersIfNetworkChanged(
    networkId: ETHEREUM_NETWORKS | undefined,
    lastNetworkId: ETHEREUM_NETWORKS | undefined,
  ) {
    if (networkId == null || lastNetworkId === networkId) {
      return
    }
    this.users = []
    this.clearCachedUserStores()
    this.isLoadingUsers = true

    const users = await this.usersDB.getUsers(networkId!)

    const userAddress = getNetworkLastUsedUserAddress(networkId!)
    let user: IUser | undefined
    if (userAddress !== '') {
      user = users.find((_user) => _user.userAddress === userAddress)
    }

    runInAction(() => {
      this.users = users
      this.unsetUser()
      if (user != null) {
        this.useUser(user)
      }
      this.isLoadingUsers = false
    })
  }

  @action
  private addUser(user: IUser) {
    this.users = this.users.concat(user)
  }

  @action
  private removeUser(user: IUser) {
    this.users = this.users.filter(
      (_user) => _user.userAddress !== user.userAddress,
    )

    if (this.isCurrentUser(user.networkId, user.userAddress)) {
      this.unsetUser()
    }
  }

  @action
  private unsetUser() {
    this.currentUserStore = undefined
  }
}

export function getAvatarHashByUser(user: IUser): string {
  switch (user.status) {
    case USER_STATUS.OK:
    case USER_STATUS.IDENTITY_UPLOADED:
      return sha3(`${user.userAddress}${user.blockHash}`)
    default:
      return ''
  }
}

function setNetworkLastUsedUserAddress({ networkId, userAddress }: IUser) {
  localStorage.setItem(`keymesh@${networkId}@last-used-user`, userAddress)
}

function getNetworkLastUsedUserAddress(networkId: ETHEREUM_NETWORKS): string {
  return (
    localStorage.getItem(`keymesh@${networkId}@last-used-user`) || ''
  ).toString()
}

export async function getUserPublicKey(
  userAddress: string,
  contractStore: ContractStore,
): Promise<proteusKeys.PublicKey> {
  if (!isAddress(userAddress)) {
    throw new Error('address not valid')
  }

  const { publicKey } = await contractStore.identitiesContract.getIdentity(
    userAddress,
  )

  if (isHexZeroValue(publicKey)) {
    throw new Error('cannot find identity')
  }

  return publicKeyFromHexStr(publicKey)
}
