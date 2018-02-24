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
  utf8ToHex,
} from '../utils/hex'

import { UserCachesStore } from './UserCachesStore'
import ENV from '../config'

export class BoundSocialsStore {
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

  public uploadBindingSocial = async (
    social: IBindingSocial,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      uploadingDidComplete = noop,
      uploadingDidFail = noop,
    }: IUploadingLifecycle = {},
  ) => {
    const verification = await this.userCachesStore.getVerification(this.userStore.user.userAddress)
    const newBoundSocials: IBoundSocials = Object.assign({}, verification.boundSocials)

    const { username, proofURL, platform } = social
    newBoundSocials[platform] = { username, proofURL }

    const signature = this.userStore.sign(JSON.stringify(newBoundSocials))
    const signedBoundSocials: ISignedBoundSocials = { signature, socialMedias: newBoundSocials }
    const signedBoundSocialsHex = utf8ToHex(JSON.stringify(signedBoundSocials))

    transactionWillCreate()
    this.contractStore.boundSocialsContract.bind(this.userStore.user.userAddress, signedBoundSocialsHex)
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === ENV.REQUIRED_CONFIRMATION_NUMBER) {
          if (!receipt.events) {
            uploadingDidFail(new Error('Unknown error'))
            return
          }

          await this.saveBoundSocialsToDB(newBoundSocials)

          uploadingDidComplete()
        }
      })
      .on('error', (error: Error) => {
        uploadingDidFail(error)
      })
  }

  private async saveBoundSocialsToDB(boundSocials: IBoundSocials) {
    boundSocials.nonce++
    const { userAddress } = this.userStore.user
    const verification = await this.userCachesStore.getVerification(userAddress)
    verification.boundSocials = boundSocials
    verification.verifyStatues = NewIVerifyStatuses()

    return this.userCachesStore.setVerification(userAddress, verification)
  }
}

export enum UPLOADING_FAIL_CODE {
  UNKNOWN = 0,
  NO_NEW_BINDING,
}

interface IUploadingLifecycle extends ITransactionLifecycle {
  uploadingDidComplete?: () => void
  uploadingDidFail?: (err: Error | null, code?: UPLOADING_FAIL_CODE) => void
}

export enum PLATFORMS {
  GITHUB = 'github',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
}

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

export enum BINDING_SOCIAL_STATUS {
  CHECKED = 100,
  TRANSACTION_CREATED = 200,
  CONFIRMED = 300,
}

export enum VERIFY_SOCIAL_STATUS {
  INVALID = 100,
  VALID = 200,
}

export const GITHUB_GIST_FILENAME = 'keymesh.md'

export interface IBoundSocial {
  username: string
  proofURL: string
}

export interface IBoundSocials {
  twitter?: IBoundSocial
  github?: IBoundSocial
  facebook?: IBoundSocial
  nonce: number
}

export interface ISignedBoundSocials {
  socialMedias: IBoundSocials
  signature: string
}

export interface ISignedClaim {
  userAddress: string
  signature: string
}

export interface IBindingSocial extends IBoundSocial {
  signedClaim: ISignedClaim
  status: BINDING_SOCIAL_STATUS
  platform: PLATFORMS
}

export interface IBindingSocials {
  twitter?: IBindingSocial
  github?: IBindingSocial
  facebook?: IBindingSocial
}

export interface IVerifyStatus {
  status: VERIFY_SOCIAL_STATUS
  lastVerifiedAt: number
}

export interface IVerifyStatuses {
  github: IVerifyStatus
  twitter: IVerifyStatus
  facebook: IVerifyStatus
}

export function NewIVerifyStatuses(): IVerifyStatuses {
  return {
    github: { status: VERIFY_SOCIAL_STATUS.INVALID, lastVerifiedAt: 0 },
    twitter: { status: VERIFY_SOCIAL_STATUS.INVALID, lastVerifiedAt: 0 },
    facebook: { status: VERIFY_SOCIAL_STATUS.INVALID, lastVerifiedAt: 0 },
  }
}
