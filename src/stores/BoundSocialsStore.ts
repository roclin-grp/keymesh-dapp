import {
  runInAction,
  observable,
} from 'mobx'
import {
  UserStore,
  IUserIdentityKeys,
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
  Databases,
} from '../databases'
// import {
//   Iverifications,
// } from '../DB/VerificationsDB'

import {
  GithubResource,
} from '../resources/github'

export class BoundSocialsStore {
  @observable isVerificationsLoaded = false

  constructor({
    databases,
    userStore,
    contractStore,
  }: {
    databases: Databases
    userStore: UserStore
    contractStore: ContractStore
  }) {
    this.userStore = userStore
    this.databases = databases
    this.contractStore = contractStore

    this.init()
  }

  private databases: Databases
  private userStore: UserStore
  private contractStore: ContractStore

  private bindingSocials: IBindingSocials
  private boundSocials: IBoundSocials
  private verifications: IVerifications

  public uploadBindingSocials = async (
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      uploadingDidComplete = noop,
      uploadingDidFail = noop,
    }: IUploadingLifecycle = {},
  ) => {
    const filteredBindingSocials = filterUndefinedItem(this.bindingSocials)
    if ('{}' === JSON.stringify(filteredBindingSocials)) {
      uploadingDidFail(null, UPLOADING_FAIL_CODE.NO_NEW_BINDING)
      return
    }

    const newBoundSocials: IBoundSocials = Object.assign(this.boundSocials, filteredBindingSocials)

    const signature = this.userStore.sign(JSON.stringify(newBoundSocials))
    const signedBoundSocials: ISignedBoundSocials = {signature, socialMedias: newBoundSocials}
    const signedBoundSocialsHex = utf8ToHex(JSON.stringify(signedBoundSocials))

    transactionWillCreate()
    this.contractStore.boundSocialsContract.bind(this.userStore.user.userAddress, signedBoundSocialsHex)
      .on('transactionHash', (hash) => {
        transactionDidCreate(hash)
        runInAction(() => {
          Object.keys(this.bindingSocials)
            .filter((key) => this.bindingSocials[key] !== undefined)
            .forEach((key) => this.bindingSocials[key].status = BINDING_SOCIAL_STATUS.TRANSACTION_CREATED)
        })
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          if (!receipt.events) {
            uploadingDidFail(new Error('Unknown error'))
            return
          }

          runInAction(() => {
            this.bindingSocials = {}
            this.boundSocials = Object.assign({}, newBoundSocials)
          })

          await this.persistBindingSocials()
          await this.persistBoundSocials()

          uploadingDidComplete()
        }
      })
      .on('error', (error: Error) => {
        uploadingDidFail(error)
      })
  }

  public addGithubBindingSocial = (bindingSocial: IBindingSocial) => {
    this.bindingSocials.github = bindingSocial
    return this.persistBindingSocials()
  }

  public addTwitterBindingSocial = (bindingSocial: IBindingSocial) => {
    this.bindingSocials.twitter = bindingSocial
    return this.persistBindingSocials()
  }

  public addFacebookBindingSocial = (bindingSocial: IBindingSocial) => {
    this.bindingSocials.facebook = bindingSocial
    return this.persistBindingSocials()
  }

  private persistBindingSocials() {
    return this.databases.verificationsDB.updateVerifications(this.verifications, {
      bindingSocials: this.bindingSocials,
    })
  }

  private persistBoundSocials() {
    return this.databases.verificationsDB.updateVerifications(this.verifications, {
      boundSocials: this.boundSocials,
    })
  }

  private async init() {
    const {
      user,
    } = this.userStore
    let verifications = await this.databases.verificationsDB.getVerificationsOfUser(user)

    if (typeof verifications === 'undefined') {
      verifications = await this.databases.verificationsDB.createVerifications(user)
    }

    this.verifications = verifications
    this.bindingSocials = verifications.bindingSocials
    this.boundSocials = verifications.boundSocials

    runInAction(() => {
      this.isVerificationsLoaded = true
    })
  }
}

export interface IVerifications extends IUserIdentityKeys {
  bindingSocials: IBindingSocials
  boundSocials: IBoundSocials
  lastFetchBlock: number
}

export enum UPLOADING_FAIL_CODE {
  UNKNOWN = 0,
  NO_NEW_BINDING,
}

interface IUploadingLifecycle extends ITransactionLifecycle {
  uploadingDidComplete?: () => void
  uploadingDidFail?: (err: Error | null, code?: UPLOADING_FAIL_CODE) => void
}

function filterUndefinedItem(obj: Object): Object {
  const ret = {}
  Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .forEach((key) => ret[key] = obj[key])

  return ret
}

export enum SOCIAL_MEDIA_PLATFORMS {
  GITHUB = 'github',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
}

export const SOCIAL_MEDIAS = [
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.GITHUB,
    'label': 'GitHub',
  },
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.TWITTER,
    'label': 'Twitter',
  },
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.FACEBOOK,
    'label': 'Facebook',
  },
]

export enum BINDING_SOCIAL_STATUS {
  CHECKED = 100,
  TRANSACTION_CREATED = 200,
  CONFIRMED = 300,
}

export enum VERIFY_SOCIAL_STATUS {
  NOT_FOUND = 0,
  INVALID = 100,
  VALID = 200,
}

export const GITHUB_GIST_FILENAME = 'keymail.md'

export async function getGithubClaimByProofURL(url: string): Promise<ISignedGithubClaim | null> {
  const id = /[0-9a-f]+$/.exec(url)
  if (id === null) {
    return null
  }

  const _id = id[0]
  const gist = await GithubResource.getGist(_id)
  return await getGithubClaimByRawURL(gist.files[GITHUB_GIST_FILENAME].raw_url)
}

export async function getGithubClaimByRawURL(rawURL: string): Promise<ISignedGithubClaim|null> {
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
      } as ISignedGithubClaim
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
}

export interface ISignedBoundSocials {
  socialMedias: IBoundSocials
  signature: string
}

export interface IGithubClaim {
  userAddress: string
  service: {
    name: string
    username: string
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
  signedClaim: ISignedGithubClaim|ISignedTwitterClaim|ISignedFacebookClaim
  status: BINDING_SOCIAL_STATUS
}

export interface IBindingSocials {
  twitter?: IBindingSocial
  github?: IBindingSocial
  facebook?: IBindingSocial
}
