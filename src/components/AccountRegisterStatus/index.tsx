import * as React from 'react'

import { Tooltip, Icon } from 'antd'
import TransactionStatus, { TRANSACTION_STATUS } from '../TransactionStatus'

import * as classes from './index.css'

import { observer } from 'mobx-react'
import { UserStore, USER_STATUS } from '../../stores/UserStore'

import { storeLogger } from '../../utils/loggers'
import { sleep } from '../../utils'

@observer
class AccountRegisterStatus extends React.Component<IProps, IState> {
  private isUnmounted = false
  public componentWillUnmount() {
    this.isUnmounted = true
  }

  public componentWillMount() {
    const { userStore } = this.props
    const { user } = userStore
    if (user.status === USER_STATUS.PENDING) {
      this.checkIdentityUploadStatus()
      return
    }

    if (user.status === USER_STATUS.IDENTITY_UPLOADED) {
      this.uploadPreKeys()
      return
    }

    const status = getRegisterStatusByUserStatus(user.status)
    this.setRegisterStatus(status)
  }

  public componentDidMount() {
    this.props.getRetry(this.checkIdentityUploadStatus)
  }

  public render() {
    const { user, confirmationCounter } = this.props.userStore
    const { status } = this.state
    if (status == null) {
      return null
    }

    switch (status) {
      case REGISTER_STATUS.IDENTITY_UPLOADING:
      case REGISTER_STATUS.CHECK_IDENTITY_TIMEOUT:
      case REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR:
      case REGISTER_STATUS.IDENTITY_UPLOAD_TRANSACTION_ERROR: {
        const transactionStatus = getTransactionStatusByRegisterStatus(status)
        const { networkId, identityTransactionHash } = user
        return (
          <TransactionStatus
            networkId={networkId}
            transactionHash={identityTransactionHash}
            status={transactionStatus!}
            confirmationNumber={confirmationCounter}
          />
        )
      }
      case REGISTER_STATUS.PRE_KEYS_UPLOADING:
      case REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED:
      case REGISTER_STATUS.TAKEOVERED: {
        return (
          <>
            {SUMMARY_TEXT[status]}
            <Tooltip title={HELP_MESSAGES[status]}>
              <Icon className={classes.helpIcon} type="question-circle-o" />
            </Tooltip>
          </>
        )
      }
      case REGISTER_STATUS.SUCCESS:
      default:
        return null
    }
  }

  private setRegisterStatus(status: REGISTER_STATUS) {
    this.setState(
      { status },
      () => { this.props.onStatusChanged(this.state.status!) },
    )
  }

  private checkIdentityUploadStatus = async () => {
    this.setRegisterStatus(REGISTER_STATUS.IDENTITY_UPLOADING)

    const { userStore } = this.props

    try {
      await userStore.checkIdentityUploadStatus()
      this.uploadPreKeys()
    } catch (err) {
      this.handleCheckIdentityUploadStatusFailed(err)
    }
  }

  private handleCheckIdentityUploadStatusFailed = async (err: Error) => {
    if (this.isUnmounted) {
      return
    }

    const errMessage = err.message
    if (errMessage.includes('Timeout')) {
      this.setRegisterStatus(REGISTER_STATUS.CHECK_IDENTITY_TIMEOUT)

      // retry
      await sleep(3000)
      if (this.isUnmounted) {
        return
      }
      this.checkIdentityUploadStatus()
      return
    }

    if (errMessage.includes('Taken over')) {
      this.setRegisterStatus(REGISTER_STATUS.TAKEOVERED)
      return
    }

    if (errMessage.includes('Transaction process error')) {
      this.setRegisterStatus(REGISTER_STATUS.IDENTITY_UPLOAD_TRANSACTION_ERROR)
      return
    }

    storeLogger.error('Unexpected check identity error: ', err)
    this.setRegisterStatus(REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR)
  }

  private uploadPreKeys = async () => {
    if (!this.isUnmounted) {
      this.setRegisterStatus(REGISTER_STATUS.PRE_KEYS_UPLOADING)
    }

    try {
      await this.props.userStore.preKeysManager.uploadPreKeys(true)
      this.handlePreKeysUploaded()
    } catch (err) {
      this.handlePreKeysUploadFailed(err)
    }
  }

  private handlePreKeysUploaded = async () => {
    if (!this.isUnmounted) {
      this.setRegisterStatus(REGISTER_STATUS.SUCCESS)
      return
    }

    const { onRegisterCompleted } = this.props
    if (onRegisterCompleted != null) {
      onRegisterCompleted()
    }
  }

  private handlePreKeysUploadFailed = (err: Error) => {
    if (this.isUnmounted) {
      return
    }

    storeLogger.error('failed to upload pre-keys: ', err)
    this.setRegisterStatus(REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED)
  }
}

export function getRegisterStatusByUserStatus(userStatus: USER_STATUS): REGISTER_STATUS {
  switch (userStatus) {
    case USER_STATUS.OK:
      return REGISTER_STATUS.SUCCESS
    case USER_STATUS.FAILED:
      return REGISTER_STATUS.IDENTITY_UPLOAD_TRANSACTION_ERROR
    default:
      return REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR
  }
}

export function getTransactionStatusByRegisterStatus(status: REGISTER_STATUS): TRANSACTION_STATUS {
  switch (status) {
    case REGISTER_STATUS.IDENTITY_UPLOADING:
      return TRANSACTION_STATUS.TRANSACTING
    case REGISTER_STATUS.CHECK_IDENTITY_TIMEOUT:
      return TRANSACTION_STATUS.TIMEOUT
    case REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR:
      return TRANSACTION_STATUS.UNEXCEPTED_ERROR
    case REGISTER_STATUS.IDENTITY_UPLOAD_TRANSACTION_ERROR:
      return TRANSACTION_STATUS.TRANSACTION_ERROR
    default:
      return TRANSACTION_STATUS.UNEXCEPTED_ERROR
  }
}

export enum REGISTER_STATUS {
  IDENTITY_UPLOADING,
  PRE_KEYS_UPLOADING,
  SUCCESS,
  CHECK_IDENTITY_TIMEOUT,
  TAKEOVERED,
  IDENTITY_UPLOAD_TRANSACTION_ERROR,
  PRE_KEYS_UPLOAD_FAILED,
  UNEXCEPTED_IDENTITY_UPLOAD_ERROR,
}

const SUMMARY_TEXT = Object.freeze({
  [REGISTER_STATUS.TAKEOVERED]: 'Address registered by another device',
  [REGISTER_STATUS.PRE_KEYS_UPLOADING]: 'Uploading data',
  [REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED]: 'Failed to upload data',
})

const HELP_MESSAGES = Object.freeze({
  [REGISTER_STATUS.TAKEOVERED]: 'Another device had taken over this address',
  [REGISTER_STATUS.PRE_KEYS_UPLOADING]: 'Uploading your public keys to cloud server',
  [REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED]: 'Failed to upload your public keys',
})

interface IProps {
  userStore: UserStore
  getRetry: (retry: () => void) => void
  onRegisterCompleted?: () => void
  onStatusChanged: (currentStatus: REGISTER_STATUS) => void
}

interface IState {
  status?: REGISTER_STATUS
}

export default AccountRegisterStatus
