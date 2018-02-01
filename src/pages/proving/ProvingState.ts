import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import {
  noop,
 } from '../../utils'
import { UsersStore } from '../../stores/UsersStore'
import { storeLogger } from '../../utils/loggers'
import {
  VERIFY_SOCIAL_STATUS,
  SOCIAL_MEDIA_PLATFORMS,
  UPLOADING_FAIL_CODE,
} from '../../stores/BoundSocialsStore'

useStrict(true)

export default abstract class ProvingState {
  @observable public isFinished: boolean
  @observable public isProving: boolean
  @observable public username: string

  constructor( protected usersStore: UsersStore) {
  }

  public continueHandler = async () => {
    const userAddress = this.usersStore.currentUserStore!.user.userAddress
    const {
      publicKey: identityFingerprint
    } = await this.usersStore.getIdentity(userAddress)
    if (Number(identityFingerprint) === 0) {
      return
    }

    const username = this.username

    this.setClaim(username, userAddress, identityFingerprint)
  }

  public checkProof = async () => {
    const verifyStatus = await this._checkProof()
    switch (verifyStatus) {
      case VERIFY_SOCIAL_STATUS.VALID:
        alert('Congratulations! the claim is verified')
        break
      case VERIFY_SOCIAL_STATUS.INVALID:
        alert('The claim is invalid')
        break
      case VERIFY_SOCIAL_STATUS.NOT_FOUND:
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
        transactionWillCreate: noop,
        transactionDidCreate: () => {
          storeLogger.log('created')
        },
        uploadingDidComplete: () => {
          storeLogger.log('completed')
          runInAction(() => {
            this.isFinished = true
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

  protected abstract setClaim(username: string, userAddress: string, publicKey: string): void
  protected async abstract _checkProof(): Promise<VERIFY_SOCIAL_STATUS>

  private uploadingDidFail = (err: Error | null, code = UPLOADING_FAIL_CODE.UNKNOWN) => {
    if (code === UPLOADING_FAIL_CODE.NO_NEW_BINDING) {
      storeLogger.error('no new binding')
      runInAction(() => {
        this.isFinished = true
      })
    }
    storeLogger.error('sending did fail')
  }
}
