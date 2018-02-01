import {
  runInAction,
} from 'mobx'

import {
  Identities,
  Messages,
  BroadcastMessages,
  BoundSocials
} from 'trustbase'

import { UserStore, IuserIdentityKeys } from './UserStore'
import DB, { TableSocialMedias } from '../DB'
import { utf8ToHex } from '../utils/hex'
import { ETHEREUM_NETWORKS } from './EthereumStore'
import { SENDING_FAIL_CODE } from './SessionStore'
import { GithubResource } from '../resources/github'

export class BoundSocialsStore {
  public identitiesContract: Identities
  public messagesContract: Messages
  public broadcastMessagesContract: BroadcastMessages
  public boundSocialsContract: BoundSocials

  constructor({
    db,
    userStore,
    boundSocialsContract,
  }: {
    db: DB
    userStore: UserStore
    boundSocialsContract: BoundSocials
  }) {
    this.userStore = userStore
    this.table = db.tableSocialMedias
    this.boundSocialsContract = boundSocialsContract

    this.init()
  }

  private table: TableSocialMedias
  private userStore: UserStore
  private bindingSocials: IbindingSocials
  private boundSocials: IboundSocials

  public uploadBindingSocials = async (
    {
      noNewBinding,
      transactionWillCreate,
      transactionDidCreate,
      sendingDidComplete,
      sendingDidFail,
    }: IuploadingLifecycle,
  ) => {
    const filteredBindingSocials = filterUndefinedItem(this.bindingSocials)
    if ('{}' === JSON.stringify(filteredBindingSocials)) {
      noNewBinding()
      return
    }

    const newBoundSocials: IboundSocials = Object.assign(this.boundSocials, filteredBindingSocials)

    const signature = this.userStore.sign(JSON.stringify(newBoundSocials))
    const signedBoundSocials: IsignedBoundSocials = {signature, socialMedias: newBoundSocials}
    const signedBoundSocialsHex = utf8ToHex(JSON.stringify(signedBoundSocials))

    transactionWillCreate()
    this.boundSocialsContract.bind(this.userStore.user.userAddress, signedBoundSocialsHex)
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
            sendingDidFail(new Error('Unknown error'))
            return
          }

          runInAction(() => {
            this.bindingSocials = {}
            this.boundSocials = Object.assign({}, newBoundSocials)
          })

          await this.persistBindingSocials()
          await this.persistBoundSocials()

          sendingDidComplete()
        }
      })
      .on('error', (error: Error) => {
        sendingDidFail(error)
      })
  }

  public addGithubBindingSocial = (bindingSocial: IbindingSocial) => {
    this.bindingSocials.github = bindingSocial
    return this.persistBindingSocials()
  }

  public addTwitterBindingSocial = (bindingSocial: IbindingSocial) => {
    this.bindingSocials.twitter = bindingSocial
    return this.persistBindingSocials()
  }

  public addFacebookBindingSocial = (bindingSocial: IbindingSocial) => {
    this.bindingSocials.facebook = bindingSocial
    return this.persistBindingSocials()
  }

  private persistBindingSocials() {
    return this.table.update(this.id, {bindingSocials: this.bindingSocials})
  }

  private persistBoundSocials() {
    return this.table.update(this.id, {boundSocials: this.boundSocials})
  }

  private async init() {
    await this.tryCreateRecord()
    return this.loadData()
  }

  private async loadData() {
    const row = await this.table.get(this.id)
    // load binding socials, boud socials
    this.bindingSocials = row!.bindingSocials
    this.boundSocials = row!.boundSocials
  }

  private get id(): [ETHEREUM_NETWORKS, string] {
    const {
      networkId,
      userAddress,
    } = this.userStore.user
    return [networkId, userAddress]
  }

  private async tryCreateRecord() {
    const {
      networkId,
      userAddress,
    } = this.userStore.user

    const socialMedias = await this.table.get(this.id)
    if (typeof socialMedias === 'undefined') {
      this.table.add(
        {
          networkId,
          userAddress,
          bindingSocials: {},
          boundSocials: {},
          lastFetchBlock: 0,
        },
      ).catch(() => {
        // it's not a problem
        // do nothing if the record is exists
      })
    }
  }
}

export interface IsocialMedials extends IuserIdentityKeys {
  bindingSocials: IbindingSocials
  boundSocials: IboundSocials
  lastFetchBlock: number
}

interface IuploadingLifecycle {
  noNewBinding: () => void
  transactionWillCreate: () => void
  transactionDidCreate: (transactionHash: string) => void
  sendingDidComplete: () => void
  sendingDidFail: (err: Error | null, code?: SENDING_FAIL_CODE) => void
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

export async function getGithubClaimByProofURL(url: string): Promise<IsignedGithubClaim | null> {
  const id = /[0-9a-f]+$/.exec(url)
  if (id === null) {
    return null
  }

  const _id = id[0]
  const gist = await GithubResource.getGist(_id)
  return await getGithubClaimByRawURL(gist.files[GITHUB_GIST_FILENAME].raw_url)
}

export async function getGithubClaimByRawURL(rawURL: string): Promise<IsignedGithubClaim|null> {
  return await GithubResource.getRawContent(rawURL)
    .then((resp) => resp.text())
    .then((text) => {
      const matches = /\`\`\`json([\s\S]*?)\`\`\`[\s\S]*?\`\`\`\s*(.*?)\s*\`\`\`/g.exec(text)
      if (matches === null || matches.length !== 3) {
        return null
      }
      const _claim: IgithubClaim = JSON.parse(matches[1])
      const _signature = matches[2]
      return {
        claim: _claim,
        signature: _signature,
      } as IsignedGithubClaim
    })
}

export interface IboundSocial {
  username: string
  proofURL: string
}

export interface IboundSocials {
  twitter?: IboundSocial
  github?: IboundSocial
  facebook?: IboundSocial
}

export interface IsignedBoundSocials {
  socialMedias: IboundSocials
  signature: string
}

export interface IgithubClaim {
  userAddress: string
  service: {
    name: string
    username: string
  },
  ctime: number
  publicKey: string
}

export interface IsignedGithubClaim {
  claim: IgithubClaim
  signature: string
}

export interface ItwitterClaim {
  userAddress: string
  publicKey: string
}

export interface IsignedTwitterClaim {
  claim: ItwitterClaim
  signature: string
}

export interface IfacebookClaim {
  userAddress: string
  publicKey: string
}

export interface IsignedFacebookClaim {
  claim: IfacebookClaim
  signature: string
}

export interface IbindingSocial extends IboundSocial {
  signedClaim: IsignedGithubClaim|IsignedTwitterClaim|IsignedFacebookClaim
  status: BINDING_SOCIAL_STATUS
}

export interface IbindingSocials {
  twitter?: IbindingSocial
  github?: IbindingSocial
  facebook?: IbindingSocial
}
