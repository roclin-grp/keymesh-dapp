import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import { UsersStore } from '../../stores/UsersStore'
import { storeLogger } from '../../utils/loggers'
import {
  SOCIALS,
  UPLOADING_FAIL_CODE,
  IBindingSocial,
} from '../../stores/BoundSocialsStore'

useStrict(true)

const defaultCheckProofButtonContent = 'OK posted! Check for it!'
export default abstract class ProvingState {
  @observable public isFinished: boolean
  @observable public isProving: boolean
  @observable public username: string
  @observable
  public currentStep: number = 0
  @observable.ref
  public steps: string[] = []
  @observable
  public checkProofButtonContent = defaultCheckProofButtonContent
  @observable
  public checkProofButtonDisabled = false

  constructor( protected usersStore: UsersStore) {
    this.init()
  }

  public continueHandler = async () => {
    const userAddress = this.usersStore.currentUserStore!.user.userAddress
    const {
      publicKey: identityFingerprint,
    } = await this.usersStore.getIdentityByUserAddress(userAddress)
    if (Number(identityFingerprint) === 0) {
      return
    }

    const username = this.username

    this.setClaim(username, userAddress, identityFingerprint)
    runInAction(() => {
      this.currentStep = 1
    })
  }

  public checkProof = async () => {
    runInAction(() => {
      this.checkProofButtonContent = 'Checking...'
      this.checkProofButtonDisabled = true
    })
    const bindingSocial = await this.getBindingSocial()
    if (!bindingSocial) {
      runInAction(() => {
        this.checkProofButtonContent = defaultCheckProofButtonContent
        this.checkProofButtonDisabled = false
      })
      return
    }

    runInAction(() => {
      this.currentStep = 2
    })
    this.uploadBindingProof(bindingSocial)
  }

  public uploadBindingProof = async (social: IBindingSocial) => {
    const {
      uploadBindingSocial,
    } = this.usersStore.currentUserStore!.boundSocialsStore
    uploadBindingSocial(social, {
      transactionWillCreate: () => {
        runInAction(() => {
          this.checkProofButtonContent = 'Please confirm the transaction...'
          this.currentStep = 2
        })
      },
      transactionDidCreate: () => {
        runInAction(() => {
          this.checkProofButtonContent = 'Uploading...'
        })
        storeLogger.log('created')
      },
      uploadingDidComplete: () => {
        storeLogger.log('completed')
        runInAction(() => {
          this.currentStep = 3
        })
      },
      uploadingDidFail: this.uploadingDidFail,
    }).catch(this.uploadingDidFail)
  }

  @action
  public updateUsername = (username: string) => {
    this.username = username
  }
  public abstract get platform(): SOCIALS

  protected abstract init(): void
  protected abstract setClaim(username: string, userAddress: string, publicKey: string): void
  protected async abstract getBindingSocial(): Promise<IBindingSocial | undefined>

  private uploadingDidFail = (err: Error | null, code = UPLOADING_FAIL_CODE.UNKNOWN) => {
    if (code === UPLOADING_FAIL_CODE.NO_NEW_BINDING) {
      storeLogger.error('no new binding')
      runInAction(() => {
        this.currentStep = 3
      })
    }
    storeLogger.error('sending did fail')

  }
}
