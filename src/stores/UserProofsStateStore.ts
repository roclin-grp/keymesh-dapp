import {
  observable,
  computed,
  runInAction,
  action,
} from 'mobx'
import { keys } from 'wire-webapp-proteus'

import {
  VERIFIED_SOCIAL_STATUS,
  PLATFORMS,
  GITHUB_GIST_FILENAME,
  claimTextToSignedClaim,
  ISignedSocialProof,
  forablePlatforms,
  ISocialProof,
  IVerifiedStatus,
} from './SocialProofsStore'
import { ContractStore } from './ContractStore'
import {
  UserCachesStore,
  IUserCachesVerifications,
  IUserCachesVerification,
  getNewVerifications,
} from './UserCachesStore'
import { UserProofsStatesStore } from './UserProofsStatesStore'
import { FacebookResource } from '../resources/facebook'
import { twitterResource } from '../resources/twitter'
import { GithubResource } from '../resources/github'
import { UsersStore } from '../stores/UsersStore'
import { sleep } from '../utils'
import { sha3 } from '../utils/cryptos'
import { hexToUtf8, uint8ArrayFromHex, utf8ToHex } from '../utils/hex'
import { isBeforeOneDay } from '../utils/time'

export class UserProofsStateStore {
  @observable public verifications: IUserCachesVerifications = getNewVerifications()
  @observable public isVerifying = {
    [PLATFORMS.TWITTER]: false,
    [PLATFORMS.GITHUB]: false,
    [PLATFORMS.FACEBOOK]: false,
  }

  public isFetchingUserProofs: boolean = false

  @observable private userAddress: string = ''
  @observable private userBlockHash: string = '0x0'
  @observable private finishedInit: boolean = false
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

  public getValidProofs = () => {
    const validProofs: ISocialProofWithPlatform[] = []
    for (const platform of forablePlatforms) {
      const verification = this.verifications[platform]
      if (!verification.verifiedStatus) {
        continue
      }
      if (verification.verifiedStatus.status === VERIFIED_SOCIAL_STATUS.VALID) {
        validProofs.push({platform, socialProofs: verification.socialProof!})
      }
    }
    return validProofs
  }

  @computed
  public get isFirstLoadingProofs(): boolean {
    for (const platform of forablePlatforms) {
      const verifiction = this.verifications[platform]
      if (!verifiction || verifiction.lastFetchBlock === 0) {
          return true
      }
    }
    return false
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
        await this.fetchUserAllPlatformProofs()
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

      this.updateVerifyStatus(platform, isValid ? VERIFIED_SOCIAL_STATUS.VALID : VERIFIED_SOCIAL_STATUS.INVALID)
    } catch (err) {
      this.updateVerifyStatus(platform, VERIFIED_SOCIAL_STATUS.INVALID)
    } finally {
      this.setIsVerifying(platform, false)
      this.saveVerificationsToDB()
    }
  }

  public disposeStore() {
    this.userProofsStatesStore.disposeUserProofsStateStore(this.userAddress)
  }

  private async fetchUserAllPlatformProofs() {
    for (const platform of forablePlatforms) {
      this.fetchUserPlaformProof(platform, this.userAddress)
    }
  }

  private async fetchUserPlaformProof(platformName: PLATFORMS, userAddress: string) {
    if (!this.publicKey) {
      return
    }

    const verification = this.verifications[platformName]
    const fromBlock = verification && verification.lastFetchBlock !== undefined ? verification.lastFetchBlock : 0

    const {
      lastBlock,
      result: ProofEvents,
    } = await this.contractStore.socialProofsContract.ProofEvent({
      fromBlock,
      filter: {platformName: utf8ToHex(platformName), userAddress},
    })

    for (let i = ProofEvents.length - 1; i >= 0; i--) {
      const proofEvent = ProofEvents[i]
      const signedSocialProof: ISignedSocialProof = JSON.parse(hexToUtf8(proofEvent.data))
      if (!this.publicKey.verify(
        uint8ArrayFromHex(signedSocialProof.signature),
        JSON.stringify(signedSocialProof.socialProof),
      )) {
        continue
      }

      if ( this.isNewVerification(platformName, signedSocialProof.socialProof)) {
        this.updateVerification(platformName, {socialProof: signedSocialProof.socialProof})

        this.verify(platformName, signedSocialProof.socialProof.proofURL)
      }
      break
    }
    this.updateVerification(platformName, {lastFetchBlock: lastBlock})
    this.saveVerificationsToDB()
  }
  private isNewVerification(platform: PLATFORMS, newSocialProof: ISocialProof) {
    const verification = this.verifications[platform]
    if (! verification.socialProof) {
      return true
    }

    return !isEquivalent(newSocialProof, verification.socialProof)
  }

  @action
  private updateVerification(platform: PLATFORMS, verification: IUserCachesVerification) {
    const fullVerification = Object.assign(verification, this.verifications[platform])
    this.verifications[platform] = fullVerification
    this.verifications = Object.assign({}, this.verifications)
  }

  private async waitForInitialise(interval = 1000) {
    while (!this.finishedInit) {
      await sleep(interval)
    }
  }

  private saveVerificationsToDB() {
    this.userCachesStore.setVerifications(this.userAddress, this.verifications)
  }

  private async init() {
    const identity = await this.userCachesStore.getIdentityByUserAddress(this.userAddress)
    const verifications = await this.userCachesStore.getVerifications(this.userAddress)
    runInAction(async () => {
      this.userBlockHash = identity.blockHash
      this.verifications = verifications
    })

    this.publicKey = await this.usersStore.getUserPublicKey(this.userAddress)
    runInAction(() => {
      this.finishedInit = true
    })
    this.verifyAll()
  }

  private async verifyAll() {
    for (const platform of forablePlatforms) {
      const verification = this.verifications[platform]
      if (verification.socialProof && isNeedVerify(verification.verifiedStatus)) {
        this.verify(platform, verification.socialProof.proofURL)
      }
    }
  }

  @action
  private setIsVerifying(platform: PLATFORMS, value: boolean) {
    this.isVerifying[platform] = value
  }

  private updateVerifyStatus(platform: PLATFORMS, verifiedStatus: VERIFIED_SOCIAL_STATUS) {
    this.updateVerification(platform, {verifiedStatus: {
        status: verifiedStatus,
        lastVerifiedAt: new Date().getTime(),
    }})
  }
}

const getClaimTextFunctions = {
  [PLATFORMS.FACEBOOK]: (proofURL: string) => FacebookResource.getPost(proofURL),
  [PLATFORMS.TWITTER]: (proofURL: string) => twitterResource.getTweet(proofURL),
  [PLATFORMS.GITHUB]: (proofURL: string) => GithubResource.getGistFileContent(proofURL, GITHUB_GIST_FILENAME),
}

function isEquivalent(a: object, b: object): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isNeedVerify(verifiedStatus?: IVerifiedStatus): boolean {
    return ! verifiedStatus || isBeforeOneDay(verifiedStatus.lastVerifiedAt)
}

interface ISocialProofWithPlatform {
  platform: PLATFORMS
  socialProofs: ISocialProof
}
