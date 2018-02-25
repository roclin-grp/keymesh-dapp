import {
  observable,
  computed,
  runInAction,
  action,
} from 'mobx'
import { keys } from 'wire-webapp-proteus'

import {
  VERIFY_SOCIAL_STATUS,
  IBoundSocials,
  ISignedBoundSocials,
  IVerifyStatuses,
  NewIVerifyStatuses,
  PLATFORMS,
  GITHUB_GIST_FILENAME,
  claimTextToSignedClaim,
} from './BoundSocialsStore'
import { ContractStore } from './ContractStore'
import { UserCachesStore } from './UserCachesStore'
import { UserProofsStatesStore } from './UserProofsStatesStore'
import { FacebookResource } from '../resources/facebook'
import { twitterResource } from '../resources/twitter'
import { GithubResource } from '../resources/github'
import { UsersStore } from '../stores/UsersStore'
import { sleep } from '../utils'
import { sha3 } from '../utils/cryptos'
import { hexToUtf8, uint8ArrayFromHex } from '../utils/hex'
import { isBeforeOneDay } from '../utils/time'

export class UserProofsStateStore {
  @observable public verifyStatuses: IVerifyStatuses = NewIVerifyStatuses()
  @observable public userBoundSocials: IBoundSocials = {
    [PLATFORMS.TWITTER]: undefined,
    [PLATFORMS.GITHUB]: undefined,
    [PLATFORMS.FACEBOOK]: undefined,
    nonce: 0,
  }
  @observable public isVerifying = {
    [PLATFORMS.TWITTER]: false,
    [PLATFORMS.GITHUB]: false,
    [PLATFORMS.FACEBOOK]: false,
  }

  public isFetchingUserProofs: boolean = false

  @observable private userAddress: string = ''
  @observable private userBlockHash: string = '0x0'
  @observable private finishedInit: boolean = false
  @observable private userLastFetchBlock: number = 0
  private publicKey: keys.PublicKey | undefined
  private userCachesStore: UserCachesStore
  private userProofsStatesStore: UserProofsStatesStore

  constructor(
    userAddress: string,
    private contractStore: ContractStore,
    private usersStore: UsersStore,
  ) {
    this.userAddress = userAddress
    this.userCachesStore = this.usersStore.userCachesStore
    this.userProofsStatesStore = this.usersStore.userProofsStatesStore
    this.init()
  }

  @computed
  public get isLoadingProofs() {
    return this.userLastFetchBlock === 0
  }

  @computed
  public get avatarHash() {
    if (this.userBlockHash !== '0x0' && this.userAddress !== '') {
      return sha3(this.userAddress + this.userBlockHash)
    }
    return ''
  }

  public async startFetchUserProofs(interval = 1000) {
    if (this.isFetchingUserProofs) {
      return
    }

    this.isFetchingUserProofs = true

    await this.waitForInitialise()
    if (!this.publicKey) {
      // could not load public key, address is invalid or some other things
      // went wrong, stop fetching
      this.isFetchingUserProofs = false
      return
    }

    while (this.isFetchingUserProofs) {
      try {
        await this.fetchUserProofs()
      } finally {
        await sleep(interval)
      }
    }
  }

  public stopFetchUserProofs() {
    this.isFetchingUserProofs = false
  }

  public async verify(platform: PLATFORMS, proofURL: string) {
    if (!this.publicKey) {
      return
    }

    this.setIsVerifying(platform, true)
    try {
      const claimText = await getClaimTextFunctions[platform](proofURL)
      if (claimText === null) {
        throw new Error('Claim text not found')
      }

      const signedClaim = claimTextToSignedClaim(claimText)
      const isValid = this.publicKey.verify(
        uint8ArrayFromHex(signedClaim.signature),
        signedClaim.userAddress,
      )

      this.updateVerifyStatus(platform, isValid ? VERIFY_SOCIAL_STATUS.VALID : VERIFY_SOCIAL_STATUS.INVALID)
    } catch (err) {
      this.updateVerifyStatus(platform, VERIFY_SOCIAL_STATUS.INVALID)
    } finally {
      this.setIsVerifying(platform, false)
      this.saveVerificationToDB()
    }
  }

  public disposeStore() {
    this.userProofsStatesStore.disposeUserProofsStateStore(this.userAddress)
  }

  private async fetchUserProofs() {
    const publicKey = this.publicKey
    if (!publicKey) {
      return
    }

    const {
      lastBlock,
      result: bindEvents,
    } = await this.contractStore.boundSocialsContract.getBindings({
      fromBlock: this.userLastFetchBlock,
      userAddress: this.userAddress,
    })

    runInAction(() => {
      this.userLastFetchBlock = lastBlock
    })
    for (let i = bindEvents.length - 1; i >= 0; i--) {
      const bindEvent: any = bindEvents[i]
      const _signedBoundSocial: ISignedBoundSocials = JSON.parse(hexToUtf8(bindEvent.signedBoundSocials))
      if (_signedBoundSocial.socialMedias.nonce > this.userBoundSocials.nonce) {
        if (!publicKey.verify(
          uint8ArrayFromHex(_signedBoundSocial.signature),
          JSON.stringify(_signedBoundSocial.socialMedias),
        )) {
          continue
        }

        runInAction(() => {
          this.userBoundSocials = _signedBoundSocial.socialMedias
        })
        this.verifyAll()
        break
      }
    }
    this.saveVerificationToDB()
  }

  private async waitForInitialise(interval = 1000) {
    while (!this.finishedInit) {
      await sleep(interval)
    }
  }

  private async verifyAll(onlyBeforeOneDay: boolean = false) {
    const {
      userBoundSocials,
      verifyStatuses,
    } = this

    for (const platform of Object.values(PLATFORMS) as PLATFORMS[]) {
      const boundSocial = userBoundSocials[platform]
      if (boundSocial && (!onlyBeforeOneDay || isBeforeOneDay(verifyStatuses[platform].lastVerifiedAt))) {
        this.verify(platform, boundSocial.proofURL)
      }
    }
  }

  private saveVerificationToDB() {
    this.userCachesStore.setVerification(this.userAddress, {
      boundSocials: this.userBoundSocials,
      lastFetchBlock: this.userLastFetchBlock,
      verifyStatues: this.verifyStatuses,
    })
  }

  private async init() {
    const identity = await this.userCachesStore.getIdentityByUserAddress(this.userAddress)
    const verifications = await this.userCachesStore.getVerification(this.userAddress)
    const verifyStatues = verifications.verifyStatues
    runInAction(async () => {
      this.userBlockHash = identity.blockHash
      this.userBoundSocials = verifications.boundSocials
      this.userLastFetchBlock = verifications.lastFetchBlock
      this.verifyStatuses = verifyStatues
    })

    this.publicKey = await this.usersStore.getUserPublicKey(this.userAddress)
    runInAction(() => {
      this.finishedInit = true
    })
    this.verifyAll(true)
  }

  @action
  private setIsVerifying(platform: PLATFORMS, value: boolean) {
    this.isVerifying[platform] = value
  }

  @action
  private updateVerifyStatus(platform: PLATFORMS, verifyStatus: VERIFY_SOCIAL_STATUS) {
    Object.assign(this.verifyStatuses, {
      [platform]: {
        status: verifyStatus,
        lastVerifiedAt: new Date().getTime(),
      },
    })
    this.isVerifying[platform] = false
  }
}

const getClaimTextFunctions = {
  [PLATFORMS.FACEBOOK]: (proofURL: string) => FacebookResource.getPost(proofURL),
  [PLATFORMS.TWITTER]: (proofURL: string) => twitterResource.getTweet(proofURL),
  [PLATFORMS.GITHUB]: (proofURL: string) => GithubResource.getGistFileContent(proofURL, GITHUB_GIST_FILENAME),
}
