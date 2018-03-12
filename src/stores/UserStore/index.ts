import { observable, computed, reaction, action, IReactionDisposer } from 'mobx'

import CryptoBox from './CryptoBox'
import { MessageCenter } from './MessageCenter'
import { PreKeysManager } from './PreKeysManager'
import GettingStartedQuests from './GettingStartedQuests'

import { MetaMaskStore, ETHEREUM_NETWORKS } from '../MetaMaskStore'
import { ContractStore } from '../ContractStore'
import { UsersStore, getAvatarHashByUser } from '../UsersStore'
import { SocialProofsStore } from '../SocialProofsStore'
import { SessionsStore } from '../SessionsStore'

import { getDatabases } from '../../databases'
import { UsersDB, IUpdateUserOptions } from '../../databases/UsersDB'

import { isHexZeroValue } from '../../utils/hex'
import { getPublicKeyFingerPrint } from '../../utils/proteus'
import {
  dumpCryptobox,
  IDumpedDatabases,
  downloadObjectAsJson,
} from '../../utils/data'

import { storeLogger } from '../../utils/loggers'
import { sleep } from '../../utils'

export class UserStore {
  @observable public readonly user: IUser
  public readonly cryptoBox: CryptoBox
  public readonly preKeysManager: PreKeysManager
  public readonly chatMessagesCenter: MessageCenter
  public readonly sessionsStore: SessionsStore
  public readonly socialProofsStore: SocialProofsStore
  public readonly gettingStartedQuests: GettingStartedQuests

  @observable private _confirmationCounter: number | undefined = undefined
  private readonly usersDB: UsersDB
  private readonly userRef: IUser
  private readonly disposeUpdateUserReaction: IReactionDisposer

  @computed
  public get isCurrentWalletCorrespondingUser(): boolean {
    return (
      this.metaMaskStore.currentEthereumAccount != null &&
      this.user.userAddress === this.metaMaskStore.currentEthereumAccount
    )
  }

  @computed
  public get isUsing(): boolean {
    const { currentUserStore } = this.usersStore
    return (
      currentUserStore != null &&
      currentUserStore.user.userAddress === this.user.userAddress
    )
  }

  @computed
  public get avatarHash(): string {
    return getAvatarHashByUser(this.user)
  }

  @computed
  public get isRegisterCompleted(): boolean {
    const { status } = this.user
    return status === USER_STATUS.OK || status === USER_STATUS.FAILED
  }

  @computed
  public get confirmationCounter(): number | undefined {
    return this._confirmationCounter
  }

  @computed
  private get updateableUserData(): IUpdateUserOptions {
    return {
      status: this.user.status,
      blockHash: this.user.blockHash,
      lastFetchBlockOfChatMessages: this.user.lastFetchBlockOfChatMessages,
    }
  }

  constructor(
    user: IUser,
    private readonly metaMaskStore: MetaMaskStore,
    private readonly contractStore: ContractStore,
    private readonly usersStore: UsersStore,
  ) {
    this.usersDB = getDatabases().usersDB
    this.user = this.userRef = user

    const cryptoBox = new CryptoBox(this.user, contractStore)
    this.cryptoBox = cryptoBox

    this.preKeysManager = new PreKeysManager(this)
    this.chatMessagesCenter = new MessageCenter(this, contractStore)
    this.sessionsStore = new SessionsStore(this, usersStore, contractStore)
    this.socialProofsStore = new SocialProofsStore({
      userStore: this,
      contractStore,
      userCachesStore: this.usersStore.userCachesStore,
    })

    this.gettingStartedQuests = new GettingStartedQuests(this.user)

    // update usersStore's user data reference
    this.disposeUpdateUserReaction = reaction(
      () => this.updateableUserData,
      this.updateReferenceUser.bind(this),
    )
  }

  public async checkIdentityUploadStatus(): Promise<void> {
    const { user } = this
    if (user.status !== USER_STATUS.PENDING) {
      return
    }

    const { identitiesContract, isAvailable } = this.contractStore
    if (!isAvailable) {
      // retry
      await sleep(3000)
      return this.checkIdentityUploadStatus()
    }

    const { identityTransactionHash, userAddress } = user
    const { getReceipt } = this.contractStore.getProcessingTransactionHandler(
      identityTransactionHash,
    )

    try {
      await getReceipt({ onConfirmation: this.handleConfirmation.bind(this) })

      const { blockNumber, publicKey } = await identitiesContract.getIdentity(
        userAddress,
      )
      if (!publicKey || isHexZeroValue(publicKey)) {
        throw new Error('Can not get public key')
      }

      const identityKeyPair = await this.cryptoBox.getIdentityKeyPair()
      if (publicKey !== getPublicKeyFingerPrint(identityKeyPair.public_key)) {
        const { networkId } = user
        await this.usersStore.deleteUser(networkId, userAddress)
        throw new Error('Taken over')
      }

      const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)

      if (isHexZeroValue(blockHash)) {
        throw new Error('Can not get block hash')
      }

      await this.updateUser({
        blockHash,
        status: USER_STATUS.IDENTITY_UPLOADED,
      })
    } catch (err) {
      const errorMessage = (err as Error).message
      const hasfetchError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Can not get public key') ||
        errorMessage.includes('Can not get block hash')

      if (hasfetchError) {
        storeLogger.warn('failed to check identity upload status:', err)
        // retry
        await sleep(3000)
        this.checkIdentityUploadStatus()
        return
      }

      if (errorMessage.includes('Transaction process error')) {
        await this.updateUser({
          status: USER_STATUS.FAILED,
        })
      }

      throw err
    }
  }

  /**
   * forcibly sync in-memory user with database's data
   */
  public async refreshMemoryUser() {
    const user = await this.usersDB.getUser(
      this.user.networkId,
      this.user.userAddress,
    )
    if (user != null) {
      this.updateMemoryUser(user)
    }
  }

  public async exportUser() {
    const { sessionsDB, messagesDB } = getDatabases()
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

  public async updateUser(args: IUpdateUserOptions) {
    await this.usersDB.updateUser(this.user, args)
    this.updateMemoryUser(args)
  }

  public useUser() {
    return this.usersStore.useUser(this.user)
  }

  public deleteUser() {
    this.disposeStore()
    return this.usersStore.deleteUser(
      this.user.networkId,
      this.user.userAddress,
    )
  }

  /**
   * dispose this store and sub-stores,
   * clean up side effect and caches
   */
  public disposeStore() {
    this.disposeUpdateUserReaction()
    this.chatMessagesCenter.stopFetchChatMessages()
    this.sessionsStore.disposeStore()
    this.usersStore.removeCachedUserStore(this)
  }

  private updateReferenceUser(args: IUpdateUserOptions) {
    const oldStatus = this.userRef.status
    Object.assign(this.userRef, args)

    if (oldStatus !== USER_STATUS.OK && args.status === USER_STATUS.OK) {
      // refresh this.usersStore.usableUsers
      this.usersStore.users = this.usersStore.users.slice()
    }
  }

  @action
  private updateMemoryUser(args: IUpdateUserOptions) {
    Object.assign(this.user, args)
  }

  @action
  private handleConfirmation(confirmationCount: number) {
    this._confirmationCounter = confirmationCount
  }
}

export function getCryptoBoxIndexedDBName(user: IUser) {
  return `${user.networkId}@${user.userAddress}`
}

export enum IDENTITY_UPLOAD_CHECKING_FAIL_CODE {
  UNKNOWN = 0,
  TIMEOUT,
}

export enum USER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADED,
  OK,
  FAILED,
}

export interface IUserPrimaryKeys {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
}

export interface IUser extends IUserPrimaryKeys {
  status: USER_STATUS
  blockHash: string
  identityTransactionHash: string
  lastFetchBlockOfChatMessages: number
}

export interface IContact {
  userAddress: string
  blockHash: string
}
