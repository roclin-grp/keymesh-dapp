import {
  observable,
  computed,
  runInAction,
  action,
} from 'mobx'

import { sha3 } from '../cryptos'
import { FacebookResource } from '../resources/facebook'
import { TwitterResource } from '../resources/twitter'
import { UsersStore } from '../stores/UsersStore'
import { ContractStore } from './ContractStore'
import { hexToUtf8, uint8ArrayFromHex } from '../utils/hex'
import {
  VERIFY_SOCIAL_STATUS,
  IBoundSocials,
  ISignedBoundSocials,
  getGithubClaimByProofURL,
  IVerifyStatuses,
  NewIVerifyStatuses,
  SOCIALS,
  ISignedTwitterClaim,
  ISignedFacebookClaim,
  ISignedGithubClaim,
} from './BoundSocialsStore'
import { keys } from 'wire-webapp-proteus'
const {
  INVALID,
  VALID,
} = VERIFY_SOCIAL_STATUS

import {
  UserCachesStore,
} from './UserCachesStore'

export class UserProofsStateStore {
  @observable public verifyStatuses: IVerifyStatuses = NewIVerifyStatuses()
  @observable public userBoundSocials: IBoundSocials = {
    [SOCIALS.TWITTER]: undefined,
    [SOCIALS.GITHUB]: undefined,
    [SOCIALS.FACEBOOK]: undefined,
    nonce: 0,
  }
  @observable public isVerifying = {
    [SOCIALS.TWITTER]: false,
    [SOCIALS.GITHUB]: false,
    [SOCIALS.FACEBOOK]: false,
  }

  public isFetchingUserProofs: boolean = false

  private usersStore: UsersStore
  private contractStore: ContractStore
  private userCachesStore: UserCachesStore

  private fetchUserProofTimeout!: number

  @observable private userAddress: string = ''
  @observable private userBlockHash: string = '0x0'
  @observable private finishedInit: boolean = false
  @observable private userLastFetchBlock: number = 0
  private publicKey: keys.PublicKey | undefined

  private readonly twitterResource = new TwitterResource(
    process.env.REACT_APP_TWITTER_CONSUMER_KEY!,
    process.env.REACT_APP_TWITTER_SECRET_KEY!,
  )

  constructor({
    usersStore,
    contractStore,
    userAddress,
  }: {
      usersStore: UsersStore
      contractStore: ContractStore
      userAddress: string,
    },
  ) {
    this.usersStore = usersStore
    this.contractStore = contractStore
    this.userCachesStore = usersStore.userCachesStore
    this.userAddress = userAddress
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

  @action
  public stopFetchingUserProofs = () => {
    window.clearTimeout(this.fetchUserProofTimeout)
    this.isFetchingUserProofs = false
  }

  public fetchUserProofs = async () => {
    const publicKey = this.publicKey
    if (typeof publicKey === 'undefined') {
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
        this.verifyAllUserProofs()
        break
      }
    }
    this.persist()
  }

  public startFetchingUserProofs = (interval = 1000) => {
    if (this.isFetchingUserProofs) {
      return
    }

    const loop = async () => {
      if (!this.finishedInit) {
        this.fetchUserProofTimeout = window.setTimeout(loop, 1000)
        return
      }

      try {
        await this.fetchUserProofs()
      } finally {
        this.fetchUserProofTimeout = window.setTimeout(loop, interval)
      }
    }

    this.isFetchingUserProofs = true
    this.fetchUserProofTimeout = window.setTimeout(loop, 1000)
  }

  public verifyAllUserProofs = async () => {
    const publicKey = await this.usersStore.getUserPublicKey(this.userAddress)
    if (!publicKey) {
      return
    }

    const socials = this.userBoundSocials
    if (typeof socials.facebook !== 'undefined') {
      this.verifyFacebook()
    }

    if (typeof socials.github !== 'undefined') {
      this.verifyGithub()
    }

    if (typeof socials.twitter !== 'undefined') {
      this.verifyTwitter()
    }
  }

  public async verify(
    platform: SOCIALS,
    getClaim: () => Promise<ISignedFacebookClaim | ISignedTwitterClaim | ISignedGithubClaim | null>,
  ) {
    const updateVerifyStatus = this.getUpdateVerifyStatusFunc(platform)
    try {
      const unverifiedSignedClaim = await getClaim()

      this.checkSigAndUpdateStatus(unverifiedSignedClaim, updateVerifyStatus)
    } catch (e) {
      updateVerifyStatus(INVALID)
    }
  }

  public verifyFacebook = async () => {
    this.verify(SOCIALS.FACEBOOK, () => FacebookResource.getClaimByPostURL(this.userBoundSocials.facebook!.proofURL))
  }

  public verifyGithub = async () => {
    this.verify(SOCIALS.GITHUB, () => getGithubClaimByProofURL(this.userBoundSocials.github!.proofURL))
  }

  public verifyTwitter = async () => {
    return this.verify(
      SOCIALS.TWITTER,
      () => this.twitterResource.getSignedTwitterClaimByProofURL(this.userBoundSocials.twitter!.proofURL),
    )
  }

  private checkSigAndUpdateStatus(
    claim: ISignedTwitterClaim | ISignedFacebookClaim | ISignedGithubClaim | null,
    updateFunc: (
      verifyStatus: VERIFY_SOCIAL_STATUS,
    ) => void,
  ) {
    if (claim === null) {
      updateFunc(INVALID)
      return
    }

    if (this.publicKey!.verify(
      uint8ArrayFromHex(claim.signature),
      JSON.stringify(claim.claim),
    )) {
      updateFunc(VALID)
      return
    }

    updateFunc(INVALID)
  }

  private getUpdateVerifyStatusFunc(platform: SOCIALS) {
    runInAction(() => {
      this.isVerifying[platform] = true
    })
    return (verifyStatus: VERIFY_SOCIAL_STATUS) => {
      runInAction(() => {
        const verifyStatues = Object.assign(this.verifyStatuses, {
          [platform]: {
            status: verifyStatus,
            lastVerifiedAt: new Date().getTime(),
          },
        })
        this.verifyStatuses = verifyStatues
        this.isVerifying[platform] = false
      })

      this.persist()
    }
  }

  private persist() {
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
  }
}
