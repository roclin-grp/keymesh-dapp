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
      case REGISTER_STATUS.TRANSACTING:
      case REGISTER_STATUS.TRANSACTION_TIMEOUT:
      case REGISTER_STATUS.UNEXCEPTED_ERROR:
      case REGISTER_STATUS.TRANSACTION_ERROR: {
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
    this.setRegisterStatus(REGISTER_STATUS.TRANSACTING)

    const { userStore } = this.props

    try {
      await userStore.checkIdentityUploadStatus()
    } catch (err) {
      this.handleCheckIdentityUploadStatusFailed(err)
      return
    }

    this.handleRegisterCompleted()
  }

  private handleCheckIdentityUploadStatusFailed = async (err: Error) => {
    if (this.isUnmounted) {
      return
    }

    const errMessage = err.message
    if (errMessage.includes('Timeout')) {
      this.setRegisterStatus(REGISTER_STATUS.TRANSACTION_TIMEOUT)

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
      this.setRegisterStatus(REGISTER_STATUS.TRANSACTION_ERROR)
      return
    }

    storeLogger.error('Unexpected check identity error: ', err)
    this.setRegisterStatus(REGISTER_STATUS.UNEXCEPTED_ERROR)
  }

  private handleRegisterCompleted = async () => {
    if (!this.isUnmounted) {
      this.setRegisterStatus(REGISTER_STATUS.SUCCESS)
      return
    }

    const { onRegisterCompleted } = this.props
    if (onRegisterCompleted != null) {
      onRegisterCompleted()
    }
  }
}

export function getRegisterStatusByUserStatus(userStatus: USER_STATUS): REGISTER_STATUS {
  switch (userStatus) {
    case USER_STATUS.OK:
      return REGISTER_STATUS.SUCCESS
    case USER_STATUS.FAILED:
      return REGISTER_STATUS.TRANSACTION_ERROR
    case USER_STATUS.TAKEN_OVER:
      return REGISTER_STATUS.TAKEOVERED
    default:
      return REGISTER_STATUS.UNEXCEPTED_ERROR
  }
}

export function getTransactionStatusByRegisterStatus(status: REGISTER_STATUS): TRANSACTION_STATUS {
  switch (status) {
    case REGISTER_STATUS.TRANSACTING:
      return TRANSACTION_STATUS.TRANSACTING
    case REGISTER_STATUS.TRANSACTION_TIMEOUT:
      return TRANSACTION_STATUS.TIMEOUT
    case REGISTER_STATUS.UNEXCEPTED_ERROR:
      return TRANSACTION_STATUS.UNEXCEPTED_ERROR
    case REGISTER_STATUS.TRANSACTION_ERROR:
      return TRANSACTION_STATUS.TRANSACTION_ERROR
    default:
      return TRANSACTION_STATUS.UNEXCEPTED_ERROR
  }
}

export enum REGISTER_STATUS {
  TRANSACTING,
  SUCCESS,
  TRANSACTION_TIMEOUT,
  TAKEOVERED,
  TRANSACTION_ERROR,
  UNEXCEPTED_ERROR,
}

const SUMMARY_TEXT = Object.freeze({
  [REGISTER_STATUS.TAKEOVERED]: 'Address registered by another device',
})

const HELP_MESSAGES = Object.freeze({
  [REGISTER_STATUS.TAKEOVERED]: 'Another device had taken over this address',
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
