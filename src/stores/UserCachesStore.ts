import { getDatabases } from '../databases'
import { ETHEREUM_NETWORKS, MetaMaskStore } from './MetaMaskStore'
import { UsersStore } from './UsersStore'
import { IVerifyStatuses, IBoundSocials, NewIVerifyStatuses } from './BoundSocialsStore'
import { sha3 } from 'trustbase'
import { reaction } from 'mobx'

export class UserCachesStore {
  constructor({
    usersStore,
    metaMaskStore,
  }: {
    usersStore: UsersStore
    metaMaskStore: MetaMaskStore,
  }) {
    this.usersStore = usersStore
    this.metaMaskStore = metaMaskStore

    reaction(
      () => this.metaMaskStore.currentEthereumNetwork,
      (networkId) => {
        if (typeof networkId === 'undefined') {
          this.networkID = -1
        } else {
          this.networkID = networkId
        }
      })
  }

  private usersStore: UsersStore
  private networkID: ETHEREUM_NETWORKS
  private metaMaskStore: MetaMaskStore
  private cachedUserAvatarPromises: {
    [userAddress: string]: Promise<string>,
  } = {}
  private cachedUserIdentityPromises: {
    [userAddress: string]: Promise<IUserCachesIdentity>,
  } = {}

  public async getVerification(userAddress: string): Promise<IUserCachesVerification> {
    const user = await this.userCachesDB.get(this.networkID, userAddress)
    if (user && user.verification) {
      return user.verification
    }

    return newEmptyVerification()
  }

  public async setVerification(userAddress: string, verification: IUserCachesVerification) {
    return this.userCachesDB.update(userAddress, this.networkID, {verification})
  }

  public getAvatarHashByUserAddress = (userAddress: string): Promise<string> => {
    let cachedPromise = this.cachedUserAvatarPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.cachedUserAvatarPromises[userAddress] = this._getAvatarHashByUserAddress(userAddress)
    }
    return cachedPromise
  }

  public getIdentityByUserAddress = (userAddress: string): Promise<IUserCachesIdentity> => {
    let cachedPromise = this.cachedUserIdentityPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.cachedUserIdentityPromises[userAddress] = this._getIdentityByUserAddress(userAddress)
    }
    return cachedPromise
  }

  public _getIdentityByUserAddress = async (userAddress: string): Promise<IUserCachesIdentity> => {
    const user = await this.userCachesDB.get(this.networkID, userAddress)
    if (user && user.identity) {
      return user.identity
    }

    const {
      getBlockHash,
    } = this.metaMaskStore
    const userIdentity = await this.usersStore.getIdentityByUserAddress(userAddress)
    const identity = {
      publicKey: userIdentity.publicKey,
      blockNumber: userIdentity.blockNumber,
      blockHash: await getBlockHash(userIdentity.blockNumber),
    }
    if (!user) {
      const _newUser = await this.userCachesDB.create({
        userAddress,
        networkId: this.networkID,
        identity,
      })

      return _newUser.identity!
    }

    const newUser = await this.userCachesDB.update(userAddress, this.networkID, {identity})
    return newUser.identity!
  }

  private async _getAvatarHashByUserAddress(userAddress: string) {
    const identity = await this.getIdentityByUserAddress(userAddress)
    return sha3(`${userAddress}${identity.blockHash}`)
  }

  private get userCachesDB() {
    return getDatabases().userCachesDB
  }
}

export interface IUserCachesIdentity {
    blockHash: string
    publicKey: string
    blockNumber: number
}
export interface IUserCachesVerification {
  boundSocials: IBoundSocials
  lastFetchBlock: number
  verifyStatues: IVerifyStatuses
}

export interface IUserCaches {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identity?: IUserCachesIdentity
  verification?: IUserCachesVerification
}

export function newEmptyVerification(): IUserCachesVerification {
  return {
    boundSocials: {nonce: 0},
    lastFetchBlock: 0,
    verifyStatues: NewIVerifyStatuses(),
  }
}
