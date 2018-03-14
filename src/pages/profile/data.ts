import { observable, computed, action, Lambda, reaction } from 'mobx'

import { IProcessedUserInfo, getUserInfoByAddress, getUserInfosByUsername } from '../../stores/UserCachesStore'
import { UsersStore } from '../../stores/UsersStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'

import { isAddress } from '../../utils/cryptos'
import { storeLogger } from '../../utils/loggers'
import { publicKeyFromHexStr } from '../../utils/proteus'

import { getPreKeysPackage } from '../../PreKeysPackage'
import { UserStore } from '../../stores/UserStore'

class ProfileData {
  @observable.ref private _userInfos: IProcessedUserInfo[] | undefined = undefined

  private disposeWalletAddressReaction: Lambda | undefined

  @computed
  public get userInfos(): IProcessedUserInfo[] {
    const { _userInfos } = this
    if (_userInfos == null) {
      throw new Error('trying to access userInfo while ProfileData is still loading')
    }

    return _userInfos
  }

  @computed
  public get isLoading(): boolean {
    return this._userInfos === undefined
  }

  constructor(
    private readonly usersStore: UsersStore,
    private readonly metaMaskStore: MetaMaskStore,
    username?: string,
    userAddress?: string,
  ) {
    if (userAddress != null) {
      this.getUserAddressUserInfo(userAddress)
      return
    }

    if (username != null) {
      this.getUsernameUserInfos(username)
      return
    }

    const { currentUserStore } = this.usersStore
    if (currentUserStore == null) {
      this.setUserInfos([])
      return
    }

    this.getUserAddressUserInfo(currentUserStore.user.userAddress)
    this.disposeWalletAddressReaction = reaction(
      () => this.usersStore.currentUserStore,
      this.handleAccountChange,
    )
  }

  public disposeData() {
    const { disposeWalletAddressReaction } = this
    if (disposeWalletAddressReaction != null) {
      disposeWalletAddressReaction()
    }
  }

  private handleAccountChange = (currentUserStore?: UserStore) => {
    if (currentUserStore == null) {
      return
    }

    this.setUserInfos(undefined)
    this.getUserAddressUserInfo(currentUserStore.user.userAddress)
  }

  private async getUsernameUserInfos(username: string) {
    try {
      const rawUserInfos = await getUserInfosByUsername(this.metaMaskStore.networkID, username)
      if (rawUserInfos.length === 0) {
        // invalid username
        this.setUserInfos([])
        return
      }

      // validate user address
      const validateUserAddressPromises: Array<Promise<IProcessedUserInfo | null>> = []
      for (const userInfo of rawUserInfos) {
        const validateUserAddressPromise = this.validateUserAddress(userInfo.userAddress)
          .then(() => {
            return userInfo
          })
          .catch((err) => {
            storeLogger.error(`failed to validate userAddress(${userInfo.userAddress}`, err)
            return null
          })

        validateUserAddressPromises.push(validateUserAddressPromise)
      }
      const validatedUserInfos = await Promise.all(validateUserAddressPromises)

      // filter out null value
      const userInfos: IProcessedUserInfo[] = []
      for (const userInfo of validatedUserInfos) {
        if (userInfo == null) {
          continue
        }

        userInfos.push(userInfo)
      }

      this.setUserInfos(userInfos)
    } catch (err) {
      storeLogger.error(`failed to validate username(${username}`, err)
      // treat as invalid username
      this.setUserInfos([])
    }
  }

  private async getUserAddressUserInfo(userAddress: string) {
    if (!isAddress(userAddress)) {
      this.setUserInfos([])
      return
    }

    try {
      await this.validateUserAddress(userAddress)
      // show basic info while fetching userInfo
      this.setUserInfos([ { userAddress, verifications: [] } ])

      const userInfo = await getUserInfoByAddress(this.metaMaskStore.networkID, userAddress)

      if (userInfo == null) {
        // no verification infos
        return
      }

      this.setUserInfos([userInfo])
    } catch (err) {
      storeLogger.error(`failed to validate userAddress(${userAddress})`, err)
      // treat as invalid username
      this.setUserInfos([])
    }
  }

  private async validateUserAddress(uesrAddress: string) {
    const {
      publicKey: publicKeyHex,
    } = await this.usersStore.userCachesStore.getIdentityByUserAddress(uesrAddress)
    const publicKey = publicKeyFromHexStr(publicKeyHex)
    // try to get user's pre-keys
    await getPreKeysPackage(this.metaMaskStore.networkID, publicKey)
  }

  @action
  private setUserInfos(value: IProcessedUserInfo[] | undefined) {
    this._userInfos = value
  }
}

export default ProfileData
