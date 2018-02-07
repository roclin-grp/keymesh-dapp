import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import { UsersStore } from '../../stores/UsersStore'
import { storeLogger } from '../../utils/loggers'
import {
  VERIFY_SOCIAL_STATUS,
  SOCIAL_MEDIA_PLATFORMS,
  UPLOADING_FAIL_CODE,
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
    const verifyStatus = await this._checkProof()
    switch (verifyStatus) {
      case VERIFY_SOCIAL_STATUS.VALID:
        runInAction(() => {
          this.currentStep = 2
        })
        this.uploadBindingProof()
        break
      case VERIFY_SOCIAL_STATUS.INVALID:
        runInAction(() => {
          this.checkProofButtonContent = defaultCheckProofButtonContent
          this.checkProofButtonDisabled = false
        })
        alert('The claim is invalid')
        break
      case VERIFY_SOCIAL_STATUS.NOT_FOUND:
        runInAction(() => {
          this.checkProofButtonContent = defaultCheckProofButtonContent
          this.checkProofButtonDisabled = false
        })
        alert('Cloud not found claim')
        break
      default:
    }
  }

  public uploadBindingProof = async () => {
    const {
      isVerificationsLoaded,
      uploadBindingSocials,
    } = this.usersStore.currentUserStore!.boundSocialsStore
    if (isVerificationsLoaded) {
      uploadBindingSocials({
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
  }

  @action
  public updateUsername = (username: string) => {
    this.username = username
  }
  public abstract get platform(): SOCIAL_MEDIA_PLATFORMS

  protected abstract init(): void
  protected abstract setClaim(username: string, userAddress: string, publicKey: string): void
  protected async abstract _checkProof(): Promise<VERIFY_SOCIAL_STATUS>

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
