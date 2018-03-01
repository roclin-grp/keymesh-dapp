import { observable, computed, reaction, action, IReactionDisposer } from 'mobx'

import CryptoBox from './CryptoBox'
import { MessageCenter } from './MessageCenter'
import { PreKeysManager } from './PreKeysManager'

import {
  MetaMaskStore,
  ETHEREUM_NETWORKS,
  TRANSACTION_STATUS,
} from '../MetaMaskStore'
import { ContractStore } from '../ContractStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
  getAvatarHashByUser,
} from '../UsersStore'
import { BoundSocialsStore } from '../BoundSocialsStore'
import { SessionsStore } from '../SessionsStore'

import { getDatabases } from '../../databases'
import { UsersDB, IUpdateUserOptions } from '../../databases/UsersDB'

import { noop } from '../../utils'
import { isHexZeroValue } from '../../utils/hex'
import { getPublicKeyFingerPrint } from '../../utils/proteus'
import {
  dumpCryptobox,
  IDumpedDatabases,
  downloadObjectAsJson,
} from '../../utils/data'

import IndexedDBStore from '../../IndexedDBStore'

import ENV from '../../config'

export class UserStore {
  @observable public readonly user: IUser
  public readonly cryptoBox: CryptoBox
  public readonly preKeysManager: PreKeysManager
  public readonly chatMessagesCenter: MessageCenter
  public readonly sessionsStore: SessionsStore
  public readonly boundSocialsStore: BoundSocialsStore

  private readonly usersDB: UsersDB
  private readonly userRef: IUser
  private readonly disposeUpdateUserReaction: IReactionDisposer

  @computed
  public get isCurrentUser(): boolean {
    return (
      this.metaMaskStore.currentEthereumNetwork != null &&
      this.user.networkId === this.metaMaskStore.currentEthereumNetwork
    )
  }

  @computed
  public get avatarHash(): string {
    return getAvatarHashByUser(this.user)
  }

  @computed
  public get isRegisterCompleted(): boolean {
    const { status } = this.user
    return status === USER_STATUS.OK || status === USER_STATUS.FAIL
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

    const indexedDBStore = new IndexedDBStore(
      `${user.networkId}@${user.userAddress}`,
    )

    const cryptoBox = new CryptoBox(this, indexedDBStore, contractStore)
    this.cryptoBox = cryptoBox

    this.preKeysManager = new PreKeysManager(this, indexedDBStore)

    this.chatMessagesCenter = new MessageCenter(this, contractStore)
    this.sessionsStore = new SessionsStore(this, metaMaskStore, contractStore)

    this.boundSocialsStore = new BoundSocialsStore({
      userStore: this,
      contractStore: this.contractStore,
      userCachesStore: this.usersStore.userCachesStore,
    })

    // update usersStore's user data reference
    this.disposeUpdateUserReaction = reaction(
      () => this.updateableUserData,
      this.updateReferenceUser.bind(this),
    )
  }

  // TODO: refactor
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
    } = this.metaMaskStore
    const { identitiesContract } = this.contractStore
    const {
      networkId,
      userAddress,
      identityTransactionHash,
    } = user
    const identityKeyPair = await this.cryptoBox.getIdentityKeyPair()

    checkIdentityUploadStatusWillStart(identityTransactionHash)
    const waitForTransactionReceipt = async (blockCounter = 0, confirmationCounter = 0) => {
      try {
        const receipt = await getTransactionReceipt(identityTransactionHash)
        if (receipt) {
          if (confirmationCounter >= ENV.REQUIRED_CONFIRMATION_NUMBER) {
            const hasStatus = receipt.status != null
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
                waitForTransactionReceipt, ENV.ESTIMATE_AVERAGE_BLOCK_TIME, blockCounter + 1,
              )
              return
            }

            if (registeredIdentityFingerprint === getPublicKeyFingerPrint(identityKeyPair.public_key)) {
              const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)
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
            window.setTimeout(
              waitForTransactionReceipt, ENV.ESTIMATE_AVERAGE_BLOCK_TIME, blockCounter + 1, confirmationCounter + 1,
            )
          }
          return
        }

        if (blockCounter >= ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER) {
          checkingDidFail(null, IDENTITY_UPLOAD_CHECKING_FAIL_CODE.TIMEOUT)
          return
        }

        window.setTimeout(waitForTransactionReceipt, ENV.ESTIMATE_AVERAGE_BLOCK_TIME, blockCounter + 1)
      } catch (err) {
        checkingDidFail(err)
        return
      }
    }

    return waitForTransactionReceipt()
  }

  /**
   * forcibly sync in-memory user with database's data
   */
  public async refreshMemoryUser() {
    const user = await this.usersDB.getUser(this.user.networkId, this.user.userAddress)
    if (user != null) {
      this.updateMemoryUser(user)
    }
  }

  public async exportUser() {
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

  public async updateUser(args: IUpdateUserOptions) {
    await this.usersDB.updateUser(this.user, args)
    this.updateMemoryUser(args)
  }

  public disposeStore() {
    this.disposeUpdateUserReaction()
    this.usersStore.disposeUserStore(this.user)
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
