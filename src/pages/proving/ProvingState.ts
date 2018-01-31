import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import {
  SOCIAL_MEDIA_PLATFORMS,
  VERIFY_SOCIAL_STATUS,
} from '../../constants'

import {
  storeLogger,
  noop,
 } from '../../utils'
import { UsersStore  } from '../../stores'

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
    this.usersStore.currentUserStore!.boundSocialsStore.uploadBindingSocials({
      noNewBinding: () => {
        storeLogger.error('no new binding')
        runInAction(() => {
          this.isFinished = true
        })
      },
      transactionWillCreate: noop,
      transactionDidCreate: () => {
        storeLogger.log('created')
      },
      sendingDidComplete: () => {
        storeLogger.log('completed')
        runInAction(() => {
          this.isFinished = true
        })
      },
      sendingDidFail: () => {
        storeLogger.error('sending did fail')
      },
    })
  }

  @action
  public updateUsername = (username: string) => {
    this.username = username
  }
  public abstract get platform(): SOCIAL_MEDIA_PLATFORMS

  protected abstract setClaim(username: string, userAddress: string, publicKey: string): void
  protected async abstract _checkProof(): Promise<VERIFY_SOCIAL_STATUS>
}