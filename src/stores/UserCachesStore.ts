import { getDatabases } from '../databases'
import { ETHEREUM_NETWORKS, MetaMaskStore } from './MetaMaskStore'
import { UsersStore } from './UsersStore'
import { IVerifiedStatus, ISocialProof, PLATFORMS, platformNames } from './SocialProofsStore'
import { sha3, isAddress } from '../utils/cryptos'
import { isHexZeroValue } from '../utils/hex'
import ENV from '../config'
import { observable, computed, action } from 'mobx'
import { sleep } from '../utils'
import { storeLogger } from '../utils/loggers'
import { ContractStore } from './ContractStore'

export class UserCachesStore {
  @observable private _keyMeshTeamUserInfo: IProcessedUserInfo | undefined = undefined
  private cachedUserAvatarPromises: {
    [userAddress: string]: Promise<string>,
  } = {}
  private cachedUserIdentityPromises: {
    [userAddress: string]: Promise<IUserCachesIdentity>,
  } = {}

  @computed
  private get networkID(): ETHEREUM_NETWORKS | undefined {
    const { metaMaskStore } = this
    const { isActive } = metaMaskStore
    if (!isActive) {
      return
    }

    return metaMaskStore.networkID
  }

  @computed
  public get keyMeshTeamUserInfo(): IProcessedUserInfo | undefined {
    return this._keyMeshTeamUserInfo
  }

  constructor(
    _usersStore: UsersStore,
    private metaMaskStore: MetaMaskStore,
    private readonly contractsStore: ContractStore,
  ) {
    this.fetchKeyMeshTeamUserInfo()
    this.updateTakeoverIdentities()
  }

  public async getVerifications(userAddress: string): Promise<IUserCachesVerifications> {
    const { networkID } = this
    if (networkID == null) {
      return getNewVerifications()
    }

    const user = await this.userCachesDB.get(networkID, userAddress)
    if (user && user.verifications) {
      return user.verifications
    }

    return getNewVerifications()
  }

  public async updateTakeoverIdentities(interval = 60 * 1000) {
    let lastFetchBlock = 0
    while (true) {
      const { isAvailable } = this.contractsStore
      const { metaMaskStore } = this
      const { isActive } = metaMaskStore
      if (!isAvailable || !isActive) {
        await sleep(3000)
        continue
      }
      const { networkID } = metaMaskStore

      const cachedAddresses = await this.userCachesDB.getAllAddresses()

      if (cachedAddresses.length === 0) {
        await sleep(interval)
        continue
      }

      const {
        lastBlock,
        result,
      } = await this.contractsStore.identitiesContract.getIdentities({
        fromBlock: lastFetchBlock,
        userAddresses: cachedAddresses,
      })

      lastFetchBlock = lastBlock

      const processedAddresses: { [userAddress: string]: boolean } = {}
      const updateCachesPromises: Array<Promise<void>> = []
      for (const identity of result) {
        const { userAddress, publicKey } = identity
        if (processedAddresses[userAddress]) {
          continue
        }
        processedAddresses[userAddress] = true

        const user = await this.userCachesDB.get(networkID, userAddress)
        if (!user || !user.identity) {
          continue
        }

        const oldIdentity = user.identity
        if (oldIdentity.publicKey === publicKey) {
          continue
        }

        const updateCacheIdentityPromise = this.updateCacheIdentity(userAddress).catch((err) => {
          storeLogger.warn(`failed to update identity(${userAddress}):`, err)
        })
        updateCachesPromises.push(updateCacheIdentityPromise)
      }

      await Promise.all(updateCachesPromises)

      await sleep(interval)
    }
  }

  public async setVerifications(userAddress: string, verifications: IUserCachesVerifications) {
    const { metaMaskStore } = this
    const { isActive } = metaMaskStore
    if (!isActive) {
      return
    }

    await this.userCachesDB.update(userAddress, metaMaskStore.networkID, { verifications })
  }

  public getAvatarHashByUserAddress = (userAddress: string): Promise<string> => {
    let cachedPromise = this.cachedUserAvatarPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.cachedUserAvatarPromises[userAddress] = this._getAvatarHashByUserAddress(userAddress)
    }
    return cachedPromise
  }

  public async getIdentityByUserAddress(userAddress: string): Promise<IUserCachesIdentity> {
    const { networkID } = this
    if (networkID == null) {
      throw new Error('MetaMask is not connected')
    }

    const user = await this.userCachesDB.get(networkID, userAddress)
    if (user && user.identity) {
      return user.identity
    }

    let cachedPromise = this.cachedUserIdentityPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.fetchIdentityByUserAddress(userAddress).catch((err) => {
        storeLogger.error('failed to fetch identity: ', err)
        delete this.cachedUserIdentityPromises[userAddress]
        throw err
      })
      this.cachedUserIdentityPromises[userAddress] = cachedPromise
    }
    return cachedPromise
  }

  private async updateCacheIdentity(userAddress: string) {
    const { networkID, contractsStore } = this
    if (networkID == null) {
      throw new Error('MetaMask is not connected')
    }

    if (!contractsStore.isAvailable) {
      throw new Error('contracts are not available')
    }

    const { publicKey, blockNumber } = await this.contractsStore.identitiesContract.getIdentity(userAddress)
    const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)
    if (isHexZeroValue(blockHash)) {
      storeLogger.warn('cannot fetch blockHash')
    }

    const newIdentity: IUserCachesIdentity = {
      blockNumber,
      publicKey,
      blockHash,
    }

    await this.userCachesDB.update(userAddress, networkID, { identity: newIdentity })
  }

  private async fetchIdentityByUserAddress(userAddress: string): Promise<IUserCachesIdentity> {
    const { networkID, contractsStore } = this
    if (networkID == null) {
      throw new Error('MetaMask is not connected')
    }

    if (!contractsStore.isAvailable) {
      throw new Error('contracts are not available')
    }

    const { publicKey, blockNumber } = await this.contractsStore.identitiesContract.getIdentity(userAddress)
    if (isHexZeroValue(publicKey)) {
      throw new Error('cannot find user')
    }
    const blockHash = await this.metaMaskStore.getBlockHash(blockNumber)

    if (isHexZeroValue(blockHash)) {
      throw new Error('cannot fetch blockHash')
    }

    const identity = {
      publicKey,
      blockNumber,
      blockHash,
    }

    const newUser = await this.userCachesDB.create({
      userAddress,
      networkId: networkID,
      identity,
    })

    return newUser.identity!
  }

  private async _getAvatarHashByUserAddress(userAddress: string) {
    const identity = await this.getIdentityByUserAddress(userAddress)
    return sha3(`${userAddress}${identity.blockHash}`)
  }

  private get userCachesDB() {
    return getDatabases().userCachesDB
  }

  private async fetchKeyMeshTeamUserInfo() {
    if (this._keyMeshTeamUserInfo != null || process.env.NODE_ENV !== 'production') {
      return
    }

    const info = await getUserInfoByAddress(ENV.DEPLOYED_NETWORK_ID, ENV.KEYMESH_TEAM_ADDRESS)
    if (info == null) {
      storeLogger.error(`failed to fetch keymesh team uesr(address: ${ENV.KEYMESH_TEAM_ADDRESS}) info`)
      // retry
      await sleep(3000)
      this.fetchKeyMeshTeamUserInfo()
      return
    }

    this.setKeyMeshTeamUserInfo(info)
  }

  @action
  private setKeyMeshTeamUserInfo(info: IProcessedUserInfo) {
    this._keyMeshTeamUserInfo = info
  }
}

export function getNewVerifications() {
  const verifications = {}
  for (const platform of platformNames) {
    verifications[platform] = {}
  }
  return verifications as IUserCachesVerifications
}

export async function searchUserInfos(networkID: ETHEREUM_NETWORKS, prefix: string): Promise<IProcessedUserInfo[]> {
  const response = await fetch(
    `${ENV.SEARCH_USERS_API}?networkID=${networkID}&usernamePrefix=${encodeURIComponent(prefix)}`,
  )
  const rawData = await response.json()
  return processUserInfo(rawData)
}

export const cachedUserInfo: ICachedUserInfo = {}

// FIXME: refactor
interface ICachedUserInfo {
  [userAddressOrUsername: string]: {
    promi: Promise<IProcessedUserInfo[]>,
    lastUpdate: number,
  },
}

export async function getUserInfos(
  networkID: ETHEREUM_NETWORKS,
  userAddressOrUsername: string,
) {
  const cache = cachedUserInfo[userAddressOrUsername]
  if (cache && Date.now() - cache.lastUpdate < 5 * 60 * 1000) {
    return cache.promi
  }

  const isUserAddress = isAddress(userAddressOrUsername)
  const query = `?networkID=${networkID}&${isUserAddress ? 'userAddress' : 'username'}=${userAddressOrUsername}`

  const fetchInfosPromise = fetchUserInfos(query).catch((err) => {
    storeLogger.warn('failed to fetch users info: ', err)
    delete cachedUserInfo[userAddressOrUsername]
    return []
  })

  cachedUserInfo[userAddressOrUsername] = {
    promi: fetchInfosPromise,
    lastUpdate: Date.now(),
  }

  return fetchInfosPromise
}

export async function getUserInfoByAddress(
  networkID: ETHEREUM_NETWORKS,
  userAddress: string,
): Promise<IProcessedUserInfo | undefined> {
  const infos = await getUserInfos(networkID, userAddress)
  if (infos.length === 0) {
    return
  }

  return infos[0]
}

export function getUserInfosByUsername(
  networkID: ETHEREUM_NETWORKS,
  username: string,
): Promise<IProcessedUserInfo[]> {
  return getUserInfos(networkID, username)
}

async function fetchUserInfos(query: string): Promise<IProcessedUserInfo[]> {
  const response = await fetch(`${ENV.GET_USERS_API}${query}`)
  const rawData = await response.json()
  const infos = processUserInfo(rawData)
  return infos
}

// TODO: cache processed user info
function processUserInfo(data: IUserInfo[]): IProcessedUserInfo[] {
  const userMapping: {[userAddress: string]: IProcessedUserInfo} = {}
  const result: IProcessedUserInfo[] = []
  for (const userInfo of data) {
    const {
      userAddress,
      username,
      platformName,
      twitterOAuthInfo,
    } = userInfo
    let processedUserInfo = userMapping[userInfo.userAddress]
    if (processedUserInfo == null) {
      processedUserInfo = {
        userAddress,
        verifications: [],
      }
      result.push(processedUserInfo)
    }

    if (processedUserInfo.displayUsername == null) {
      processedUserInfo.displayUsername = username
    }

    if (processedUserInfo.description == null) {
      if (platformName === 'twitter') {
        const { description, name } = twitterOAuthInfo!
        if (description !== '') {
          processedUserInfo.description = description
        }

        if (name !== '') {
          processedUserInfo.displayUsername = name
        }
      }

      if (platformName === 'facebook') {
        // TODO
      }
    }

    processedUserInfo.verifications.push({
      platformName,
      username,
      info: platformName === 'twitter' ? twitterOAuthInfo : undefined,
    })

    if (processedUserInfo.avatarImgURL == null) {
      if (platformName === 'twitter') {
        const imgUrl = getTwitterProfileImgURL(twitterOAuthInfo!)
        if (imgUrl != null) {
          processedUserInfo.avatarImgURL = imgUrl
        }
      }

      if (platformName === 'facebook') {
        // TODO
      }
    }
  }

  return result
}

export function getTwitterProfileImgURL(twitterOAuthInfo: ITwitterOAuth): string | undefined {
  const { profile_image_url_https } = twitterOAuthInfo
  if (profile_image_url_https.includes('default_profile_images')) {
    return
  }

  return profile_image_url_https.replace('_normal', '_400x400')
}

interface ITwitterOAuth {
  description: string
  profile_image_url_https: string
  friends_count: number
  followers_count: number
  name: string
}

export interface IUserInfo {
  userAddress: string
  username: string
  platformName: string
  proofURL: string
  twitterOAuthInfo?: ITwitterOAuth
  gravatarHash?: string
}

export interface IProcessedUserInfo {
  userAddress: string
  verifications: IUserInfoVerications[]
  displayUsername?: string
  description?: string
  avatarImgURL?: string
}

export interface IUserInfoVerications {
  platformName: string
  username: string
  info?: ITwitterOAuth,
}

export interface IUserCachesIdentity {
  blockHash: string
  publicKey: string
  blockNumber: number
}

export interface IUserCachesVerification {
  socialProof?: ISocialProof
  lastFetchBlock?: number
  verifiedStatus?: IVerifiedStatus
}

export type IUserCachesVerifications = {
  [platformName in PLATFORMS]: IUserCachesVerification
}

export interface IUserCaches {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identity?: IUserCachesIdentity
  verifications?: IUserCachesVerifications
}
