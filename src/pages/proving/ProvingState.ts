import {
  observable,
  action,
  computed,
  when,
  Lambda,
} from 'mobx'

import { UsersStore } from '../../stores/UsersStore'
import {
  PLATFORMS,
  UPLOADING_FAIL_CODE,
  IBindingSocial,
  ISignedClaim,
  BINDING_SOCIAL_STATUS,
} from '../../stores/BoundSocialsStore'
import { Modal } from 'antd'
import ENV from '../../config'
import { hexToBase58, base58ToHex } from '../../utils/hex'
import { isUndefined } from '../../utils'
import { base58ToChecksumAddress } from '../../utils/cryptos'
import { storeLogger } from '../../utils/loggers'

const DEFAULT_CHECK_PROOF_BUTTON_CONTENT = 'OK posted! Upload to blockchain!'

export default abstract class ProvingState {
  @observable public claim: ISignedClaim | undefined
  @observable public username!: string
  @observable public currentStep: number = 0
  @observable.ref public steps: string[] = []
  @observable public checkProofButtonContent = DEFAULT_CHECK_PROOF_BUTTON_CONTENT
  @observable public checkProofButtonDisabled = false

  protected abstract defaultCheckingErrorContent: string

  constructor(protected usersStore: UsersStore) {
    this.init()
  }

  @computed
  public get isFinished(): boolean {
    return this.currentStep === 3
  }

  @computed
  public get isProving(): boolean {
    return !isUndefined(this.claim)
  }

  public async checkProof() {
    this.setCheckProofButton('Checking...')

    const bindingSocial = await this.getBindingSocial()
    if (!bindingSocial) {
      this.showCheckingError(this.defaultCheckingErrorContent)
      this.setCheckProofButton(DEFAULT_CHECK_PROOF_BUTTON_CONTENT)
      return
    }

    this.uploadBindingProof(bindingSocial)
  }

  @action
  public continueHandler() {
    this.setClaim(this.usersStore.currentUserStore!.user.userAddress)
    this.setStep(1)
  }

  @action
  public updateUsername(username: string) {
    this.username = username
  }

  public setupFinishedReaction(callback: () => void): Lambda {
    return when(
      () => this.isFinished,
      callback,
    )
  }

  public abstract get platform(): PLATFORMS
  protected abstract init(): void
  protected abstract getProofURL(claimText: string): Promise<string | null>

  private async getBindingSocial(): Promise<IBindingSocial | null> {
    const signedClaim = this.claim
    if (isUndefined(signedClaim)) {
      return null
    }

    const claimText = signedClaimToClaimText(signedClaim)
    const proofURL = await this.getProofURL(claimText)
    if (proofURL === null) {
      return null
    }

    return {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim,
      proofURL,
      username: this.username,
      platform: this.platform,
    }
  }

  private async uploadBindingProof(social: IBindingSocial): Promise<void> {
    this.usersStore.currentUserStore!.boundSocialsStore.uploadBindingSocial(social, {
      transactionWillCreate: () => {
        this.setCheckProofButton('Please confirm the transaction...')
        this.setStep(2)
      },
      transactionDidCreate: () => {
        this.setCheckProofButton('Uploading...')
      },
      uploadingDidComplete: () => {
        this.setStep(3)
      },
      uploadingDidFail: this.uploadingDidFail,
    }).catch(this.uploadingDidFail)
  }

  private generateSignedClaim(userAddress: string): ISignedClaim {
    const signature = this.usersStore.currentUserStore!.sign(userAddress)
    return {
      userAddress,
      signature,
    }
  }

  private uploadingDidFail(err: Error | null, code = UPLOADING_FAIL_CODE.UNKNOWN) {
    if (code === UPLOADING_FAIL_CODE.NO_NEW_BINDING) {
      this.setStep(3)
      return
    }
    storeLogger.error('Uploading binding fail\n', err)
    this.showCheckingError('Something went wrong, please retry.')
    this.setCheckProofButton(DEFAULT_CHECK_PROOF_BUTTON_CONTENT)
  }

  private showCheckingError(content: string) {
    Modal.error({
      title: 'Check claim error',
      content,
    })
  }

  @action
  private setCheckProofButton(
    content: string,
    disabled: boolean = content !== DEFAULT_CHECK_PROOF_BUTTON_CONTENT,
  ) {
    this.checkProofButtonContent = content
    this.checkProofButtonDisabled = disabled
  }

  @action
  private setClaim(userAddress: string): void {
    this.claim = this.generateSignedClaim(userAddress)
  }

  @action
  private setStep(step: number) {
    this.currentStep = step
  }
}

export function signedClaimToClaimText(signedClaim: ISignedClaim): string {
  return `#keymesh

Verifying myself:
${ENV.DEPLOYED_ADDRESS}/profile/${hexToBase58(signedClaim.userAddress)}

Signature:
${hexToBase58(signedClaim.signature)}`
}

export function claimTextToSignedClaim(claimText: string): ISignedClaim {
  const parts = new RegExp(`${ENV.DEPLOYED_ADDRESS}/profile/(\\w+)\\s+Signature:\\s+(\\w+)`).exec(claimText)
  if (parts === null) {
    throw new Error('Invalid claim text')
  }
  return {
    userAddress: base58ToChecksumAddress(parts[1]),
    signature: base58ToHex(parts[2]),
  }
}
