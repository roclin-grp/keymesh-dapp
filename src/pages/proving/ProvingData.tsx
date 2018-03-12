import * as React from 'react'

import { STATUS_TYPE } from '../../components/StatusButton'
import { Icon, Tooltip } from 'antd'

import * as classes from './index.css'

import {
  observable,
  action,
  computed,
  when,
  Lambda,
} from 'mobx'

import {
  PLATFORMS,
  ISignedClaim,
  signedClaimToClaimText,
  ISocialProof,
} from '../../stores/SocialProofsStore'

import { storeLogger } from '../../utils/loggers'
import { UserStore } from '../../stores/UserStore'

export default abstract class ProvingData {
  @observable public claim: ISignedClaim | undefined
  @observable public username!: string
  @observable public currentStep: PROVING_STEPS = PROVING_STEPS.CONNECT
  @observable.ref public steps: string[] = []
  @observable public proofStatusType: STATUS_TYPE | undefined
  @observable public proofStatusContent: JSX.Element | string | undefined
  @observable public buttonDisabled = false
  @observable public proof: ISocialProof | undefined

  protected abstract findProofHelpText: string

  constructor(protected readonly userStore: UserStore) {
    this.init()
  }

  @computed
  public get isFinished(): boolean {
    return this.currentStep === PROVING_STEPS.DONE
  }

  @action
  public async checkProof() {
    this.setProofStatusType(STATUS_TYPE.LOADING)
    this.setProofStatusContent('Checking...')

    const bindingSocial = await this.getBindingSocial()
    if (bindingSocial == null) {
      this.setProofStatusContent(
        <>
          <span>Cannot find proof</span>
          <Tooltip title={this.findProofHelpText}>
            <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </>,
      )
      this.setProofStatusType(STATUS_TYPE.WARN, false)
      return
    }

    this.clearProofStatusButton()
    this.setProof(bindingSocial.socialProof)
    this.setStep(PROVING_STEPS.RECORD)
  }

  @action
  public async continueHandler() {
    const signedClaim = await this.generateSignedClaim(this.userStore.user.userAddress)
    this.setClaim(signedClaim)
    this.setStep(PROVING_STEPS.POST)
  }

  @action
  public updateUsername(username: string) {
    this.username = username
  }

  public onProvingCompleted(callback: () => void): Lambda {
    return when(
      () => this.isFinished,
      callback,
    )
  }

  public async uploadBindingProof(): Promise<void> {
    this.userStore.socialProofsStore.uploadProof(this.platform, this.proof!, {
      transactionWillCreate: () => {
        this.setProofStatusType(STATUS_TYPE.LOADING)
        this.setProofStatusContent('Pending authorization')
      },
      transactionDidCreate: () => {
        this.setProofStatusContent('Transacting...')
      },
      uploadingDidComplete: () => {
        this.uploadingDidCompleteCallback()
      },
      uploadingDidFail: this.uploadingDidFail,
    }).catch(this.uploadingDidFail)
  }

  public abstract get platform(): PLATFORMS
  protected abstract init(): void
  protected abstract getProofURL(claimText: string): Promise<string | null>
  protected uploadingDidCompleteCallback() {
    this.setStep(PROVING_STEPS.DONE)
  }

  @action
  protected setProofStatusType(
    status: STATUS_TYPE | undefined,
    disabled: boolean = status != null,
  ) {
    this.proofStatusType = status
    this.buttonDisabled = disabled
  }

  @action
  protected setProofStatusContent(content: JSX.Element | string | undefined) {
    this.proofStatusContent = content
  }

  @action
  protected clearProofStatusButton() {
    this.setProofStatusContent(undefined)
    this.setProofStatusType(undefined)
  }

  private async getBindingSocial(): Promise<IBindingProof | null> {
    const signedClaim = this.claim
    if (signedClaim == null) {
      return null
    }

    const claimText = signedClaimToClaimText(signedClaim)
    const proofURL = await this.getProofURL(claimText)
    if (proofURL === null) {
      return null
    }

    return {
      status: BINDING_STATUS.CHECKED,
      signedClaim,
      platform: this.platform,
      socialProof: {
        proofURL,
        username: this.username,
      },
    }
  }

  private async generateSignedClaim(userAddress: string): Promise<ISignedClaim> {
    const signature = await this.userStore.cryptoBox.sign(userAddress)
    return {
      userAddress,
      signature,
    }
  }

  private uploadingDidFail = (err: Error | null) => {
    storeLogger.error('Upload binding failed', err)
    this.setProofStatusType(STATUS_TYPE.WARN, false)

    const checkTransactionTimeout = (err as Error).message.includes('Timeout')

    if (checkTransactionTimeout) {
      this.setProofStatusContent(
        <>
          <span>Transaction taking too long</span>
          <Tooltip title="Transaction was not mined within 50 blocks.">
            <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </>,
      )
      return
    }

    const hasfetchError = (err as Error).message.includes('Failed to fetch')
    if (hasfetchError) {
      this.setProofStatusContent(
        <>
          <span>Failed to connect to Ethereum network</span>
          <Tooltip title="Please check your internet connection.">
            <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </>,
      )
    }

    this.setProofStatusContent(
      <>
        <span>Oops! Something unexpected happened</span>
        <Tooltip title="Sorry! You can retry later or report bugs to us if any">
          <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
        </Tooltip>
      </>,
    )
  }

  @action
  private setProof(proof: ISocialProof) {
    this.proof = proof
  }

  @action
  private setClaim(claim: ISignedClaim): void {
    this.claim = claim
  }

  @action
  private setStep(step: number) {
    this.currentStep = step
  }
}

export enum PROVING_STEPS {
  CONNECT,
  POST,
  RECORD,
  DONE,
}

enum BINDING_STATUS {
  CHECKED,
  TRANSACTION_CREATED,
  CONFIRMED,
}

interface IBindingProof {
  signedClaim: ISignedClaim
  status: BINDING_STATUS
  platform: PLATFORMS
  socialProof: ISocialProof
}
