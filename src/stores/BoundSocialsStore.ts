import {
  runInAction,
} from 'mobx'

import {
  Identities,
  Messages,
  BroadcastMessages,
  BoundSocials
} from 'trustbase'

import { UserStore } from './UserStore'
import {
  IbindingSocial,
  IbindingSocials,
  IboundSocials,
  IsignedBoundSocials,
} from '../../typings/proof.interface'
import { SENDING_FAIL_CODE, BINDING_SOCIAL_STATUS, ETHEREUM_NETWORKS } from '../constants/index'
import DB, { TableSocialMedias } from '../DB'
import { IuserIdentityKeys } from '../../typings/interface'
import { utf8ToHex } from '../utils'

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