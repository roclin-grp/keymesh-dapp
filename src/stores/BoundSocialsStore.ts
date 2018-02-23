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

import {
  GithubResource,
} from '../resources/github'
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

          await this.persistBoundSocials(newBoundSocials)

          uploadingDidComplete()
        }
      })
      .on('error', (error: Error) => {
        uploadingDidFail(error)
      })
  }

  private async persistBoundSocials(newBoundSocials: IBoundSocials) {
    newBoundSocials.nonce++
    const { userAddress } = this.userStore.user
    const verification = await this.userCachesStore.getVerification(userAddress)
    verification.boundSocials = newBoundSocials
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

export enum SOCIALS {
  GITHUB = 'github',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
}

export const SOCIAL_LABELS = Object.freeze({
  [SOCIALS.GITHUB]: 'Github',
  [SOCIALS.TWITTER]: 'Twitter',
  [SOCIALS.FACEBOOK]: 'Facebook',
})

export const SOCIAL_PROFILE_URLS = Object.freeze({
  [SOCIALS.GITHUB]: (username: string) => 'https://github.com/' + username,
  [SOCIALS.TWITTER]: (username: string) => 'https://twitter.com/' + username,
  [SOCIALS.FACEBOOK]: (proofURL: string) => {
    const res = /(^.*?[0-9]+)/.exec(proofURL)
    return res === null ? '' : res[0]
  },
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

export async function getGithubClaimByProofURL(url: string): Promise<ISignedGithubClaim | null> {
  const id = /[0-9a-f]+$/.exec(url)
  if (id === null) {
    return null
  }

  const _id = id[0]
  const gist = await GithubResource.getGist(_id)
  return await getGithubClaimByRawURL(gist.files[GITHUB_GIST_FILENAME].raw_url)
}

export async function getGithubClaimByRawURL(rawURL: string): Promise<ISignedGithubClaim | null> {
  return await GithubResource.getRawContent(rawURL)
    .then((resp) => resp.text())
    .then((text) => {
      const matches = /\`\`\`json([\s\S]*?)\`\`\`[\s\S]*?\`\`\`\s*(.*?)\s*\`\`\`/g.exec(text)
      if (matches === null || matches.length !== 3) {
        return null
      }
      const _claim: IGithubClaim = JSON.parse(matches[1])
      const _signature = matches[2]
      return {
        claim: _claim,
        signature: _signature,
      }
    })
}

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

export interface IGithubClaim {
  userAddress: string
  service: {
    name: string
    username: string,
  },
  ctime: number
  publicKey: string
}

export interface ISignedGithubClaim {
  claim: IGithubClaim
  signature: string
}

export interface ITwitterClaim {
  userAddress: string
  publicKey: string
}

export interface ISignedTwitterClaim {
  claim: ITwitterClaim
  signature: string
}

export interface IFacebookClaim {
  userAddress: string
  publicKey: string
}

export interface ISignedFacebookClaim {
  claim: IFacebookClaim
  signature: string
}

export interface IBindingSocial extends IBoundSocial {
  signedClaim: ISignedGithubClaim | ISignedTwitterClaim | ISignedFacebookClaim
  status: BINDING_SOCIAL_STATUS
  platform: SOCIALS
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
