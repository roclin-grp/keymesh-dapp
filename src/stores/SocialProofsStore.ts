import {
  UserStore,
} from './UserStore'
import {
  ContractStore,
  ITransactionLifecycle,
} from './ContractStore'

import {
  noop,
} from '../utils'
import {
  utf8ToHex, hexToBase58, base58ToHex,
} from '../utils/hex'

import { UserCachesStore } from './UserCachesStore'
import ENV from '../config'
import { base58ToChecksumAddress } from '../utils/cryptos'
import { QUESTS } from './UserStore/GettingStartedQuests'
import { transactionPromiEventToPromise } from '../utils/transaction'

export class SocialProofsStore {
  private userStore: UserStore
  private contractStore: ContractStore
  private userCachesStore: UserCachesStore

  constructor({
    userStore,
    contractStore,
    userCachesStore,
  }: {
      userStore: UserStore
      contractStore: ContractStore
      userCachesStore: UserCachesStore,
    }) {
    this.userStore = userStore
    this.contractStore = contractStore
    this.userCachesStore = userCachesStore
  }

  public uploadProof = async (
    platformName: PLATFORMS,
    socialProof: ISocialProof,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      uploadingDidComplete = noop,
      uploadingDidFail = noop,
    }: IUploadingLifecycle = {},
  ) => {
    const signature = await this.userStore.cryptoBox.sign(JSON.stringify(socialProof))
    const signedProof: ISignedSocialProof = { signature, socialProof }
    const signedProofHex = utf8ToHex(JSON.stringify(signedProof))

    transactionWillCreate()
    const promiEvent = this.contractStore.socialProofsContract.uploadProof(
      this.userStore.user.userAddress,
      utf8ToHex(platformName),
      signedProofHex,
    )
    const transactionHash = await transactionPromiEventToPromise(promiEvent)
    transactionDidCreate(transactionHash)
    const { getReceipt } = await this.contractStore.getProcessingTransactionHandler(transactionHash)

    try {
      await getReceipt()
      await this.saveSocialProofsToDB(platformName, socialProof)
      uploadingDidComplete()

      if (platformName !== PLATFORMS.TWITTER) {
        return
      }

      const { gettingStartedQuests } = this.userStore
      if (!gettingStartedQuests.questStatues[QUESTS.CONNECT_TWITTER]) {
        gettingStartedQuests.setQuest(QUESTS.CONNECT_TWITTER, true)
      }
    } catch (err) {
      uploadingDidFail(err)
    }
  }

  private async saveSocialProofsToDB(platformName: PLATFORMS, socialProof: ISocialProof) {
    const { userAddress } = this.userStore.user
    const verifications = await this.userCachesStore.getVerifications(userAddress)
    verifications[platformName] = { socialProof }

    return this.userCachesStore.setVerifications(userAddress, verifications)
  }
}

export function signedClaimToClaimText(signedClaim: ISignedClaim, twitterUsername?: string): string {
  const base58encodedUserAddress = hexToBase58(signedClaim.userAddress)
  const base58encodedSignature = hexToBase58(signedClaim.signature)

  if (!twitterUsername) {
    return ''
  }

  return `Verifying myself: I am ${ENV.DEPLOYED_ADDRESS}/${twitterUsername}.

${base58encodedUserAddress}-${base58encodedSignature}`
}

export function claimTextToSignedClaim(claimText: string): ISignedClaim {
  const parts = new RegExp(`\\s+(\\w+)-(\\w+)`).exec(claimText)
  if (parts === null) {
    throw new Error('Invalid claim text')
  }
  return {
    userAddress: base58ToChecksumAddress(parts[1]),
    signature: base58ToHex(parts[2]),
  }
}

interface IUploadingLifecycle extends ITransactionLifecycle {
  uploadingDidComplete?: () => void
  uploadingDidFail?: (err: Error | null) => void
}

export enum PLATFORMS {
  GITHUB = 'github',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
}

export const platformNames = Object.values(PLATFORMS) as PLATFORMS[]

export const PLATFORM_LABELS = Object.freeze({
  [PLATFORMS.GITHUB]: 'GitHub',
  [PLATFORMS.TWITTER]: 'Twitter',
  [PLATFORMS.FACEBOOK]: 'Facebook',
})

export const PALTFORM_MODIFIER_CLASSES = Object.freeze({
  [PLATFORMS.TWITTER]: 'twitterTone',
  [PLATFORMS.FACEBOOK]: 'facebookTone',
  [PLATFORMS.GITHUB]: 'gitHubTone',
})

export enum VERIFIED_SOCIAL_STATUS {
  INVALID = 100,
  VALID = 200,
}

export const GITHUB_GIST_FILENAME = 'keymesh.md'

export interface ISocialProof {
  username: string
  proofURL: string
}

export interface ISignedSocialProof {
  socialProof: ISocialProof
  signature: string
}

export interface ISignedClaim {
  userAddress: string
  signature: string
}

export interface IVerifiedStatus {
  status: VERIFIED_SOCIAL_STATUS
  lastVerifiedAt: number
}
