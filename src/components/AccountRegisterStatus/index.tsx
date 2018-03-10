import * as React from 'react'

import { Tooltip, Icon } from 'antd'

import * as classes from './index.css'

import { ETHEREUM_NETWORK_TX_URL_PREFIX } from '../../stores/MetaMaskStore'
import { REGISTER_FAIL_CODE } from '../../stores/UsersStore'
import { UserStore, USER_STATUS, IDENTITY_UPLOAD_CHECKING_FAIL_CODE } from '../../stores/UserStore'

import { storeLogger } from '../../utils/loggers'

class AccountRegisterStatus extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    status: REGISTER_STATUS.PENDING,
  }

  private isUnmounted = false
  public componentWillUnmount() {
    this.isUnmounted = true
  }

  public componentWillMount() {
    const { userStore } = this.props
    const { isRegisterCompleted, user } = userStore
    if (!isRegisterCompleted) {
      this.handleCheckRegisterStatus()
      return
    }

    const status = getRegisterStatusByUserStatus(user.status)
    this.setRegisterStatus(status)
  }

  public componentDidMount() {
    this.props.getRetry(this.handleCheckRegisterStatus)
  }

  public render() {
    const { user } = this.props.userStore
    const { status } = this.state

    const helpIcon = (
      <Tooltip title={HELP_MESSAGES[status]}>
        <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
      </Tooltip>
    )

    switch (status) {
      case REGISTER_STATUS.IDENTITY_UPLOADING:
      case REGISTER_STATUS.TRANSACTION_ERROR: {
        let content = <span>{REGISTER_STATUS_SUMMARY_TEXT[status]}</span>
        const explorerUrl = ETHEREUM_NETWORK_TX_URL_PREFIX[user.networkId]
        if (explorerUrl != null) {
          content = (
            <a
              className={classes.transactionLink}
              target="_blank"
              href={`${explorerUrl}${user.identityTransactionHash}`}
            >
              {content}
            </a>
          )
        }

        return (
          <>
            {content}
            {helpIcon}
          </>
        )
      }
      case REGISTER_STATUS.IDENTITY_UPLOADED:
      case REGISTER_STATUS.TIMEOUT:
      case REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL:
      case REGISTER_STATUS.UNEXCEPTED_ERROR:
      case REGISTER_STATUS.TAKEOVERED:
        return (
          <>
            <span>{REGISTER_STATUS_SUMMARY_TEXT[status]}</span>
            {helpIcon}
          </>
        )
      case REGISTER_STATUS.PENDING:
      case REGISTER_STATUS.DONE:
      default:
        return null
    }
  }

  private setRegisterStatus(status: REGISTER_STATUS) {
    this.setState(
      { status },
      () => { this.props.onStatusChanged(this.state.status) },
    )
  }

  private handleCheckRegisterStatus = () => {
    this.props.userStore.checkIdentityUploadStatus({
      checkIdentityUploadStatusWillStart: this.checkIdentityUploadStatusWillStart,
      identityDidUpload: this.identityDidUpload,
      registerDidFail: this.registerDidFail,
      checkingDidFail: this.identityUploadCheckingDidFail,
    }).catch(this.identityUploadCheckingDidFail)
  }

  private checkIdentityUploadStatusWillStart = () => {
    if (this.isUnmounted) {
      return
    }

    this.setRegisterStatus(REGISTER_STATUS.IDENTITY_UPLOADING)
  }

  private identityDidUpload = async () => {
    if (this.isUnmounted) {
      return
    }

    this.setRegisterStatus(REGISTER_STATUS.IDENTITY_UPLOADED)

    try {
      await this.props.userStore.preKeysManager.uploadPreKeys(true)
      this.preKeysDidUpload()
    } catch (err) {
      this.preKeysUploadDidFail(err)
    }
  }

  private preKeysDidUpload = async () => {
    if (!this.isUnmounted) {
      this.setRegisterStatus(REGISTER_STATUS.DONE)
      return
    }

    const { onRegisterCompleted } = this.props
    if (onRegisterCompleted != null) {
      onRegisterCompleted()
    }
  }

  private preKeysUploadDidFail = (err: Error) => {
    if (this.isUnmounted) {
      return
    }

    storeLogger.error(err)

    this.setRegisterStatus(REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL)
  }

  private registerDidFail = (code: REGISTER_FAIL_CODE) => {
    if (this.isUnmounted) {
      return
    }

    let status: REGISTER_STATUS
    switch (code) {
      case REGISTER_FAIL_CODE.OCCUPIED:
        status = REGISTER_STATUS.TAKEOVERED
        break
      case REGISTER_FAIL_CODE.TRANSACTION_ERROR:
        status = REGISTER_STATUS.TRANSACTION_ERROR
        break
      default:
        status = REGISTER_STATUS.UNEXCEPTED_ERROR
    }

    this.setRegisterStatus(status)
  }

  private identityUploadCheckingDidFail = (_: Error | null, code = IDENTITY_UPLOAD_CHECKING_FAIL_CODE.UNKNOWN) => {
    if (this.isUnmounted) {
      return
    }

    let status: REGISTER_STATUS
    switch (code) {
      case IDENTITY_UPLOAD_CHECKING_FAIL_CODE.TIMEOUT:
        status = REGISTER_STATUS.TIMEOUT
        break
      default:
        status = REGISTER_STATUS.UNEXCEPTED_ERROR
    }

    this.setRegisterStatus(status)
  }
}

export function getRegisterStatusByUserStatus(userStatus: USER_STATUS): REGISTER_STATUS {
  switch (userStatus) {
    case USER_STATUS.OK:
      return REGISTER_STATUS.DONE
    case USER_STATUS.FAIL:
      return REGISTER_STATUS.TRANSACTION_ERROR
    default:
      return REGISTER_STATUS.UNEXCEPTED_ERROR
  }
}

export enum REGISTER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADING,
  IDENTITY_UPLOADED,
  DONE,
  TIMEOUT,
  UPLOAD_PRE_KEYS_FAIL,
  UNEXCEPTED_ERROR,
  TAKEOVERED,
  TRANSACTION_ERROR,
}

const REGISTER_STATUS_SUMMARY_TEXT = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'Transacting',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'Uploading data',
  [REGISTER_STATUS.TIMEOUT]: 'Transaction taking too long',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'Failed to upload data',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'Oops! Something unexpected happened',
  [REGISTER_STATUS.TAKEOVERED]: 'Taken over',
  [REGISTER_STATUS.TRANSACTION_ERROR]: 'Transaction failed',
})

const HELP_MESSAGES = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]:
    'Be patient, Ethereum transaction is processing (normally it would take less than 5 min)',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'Uploading your public keys to cloud server',

  [REGISTER_STATUS.TIMEOUT]: 'Transaction was not mined within 50 blocks.',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]:
    'Failed to upload your public keys to cloud server, please check your internet connection',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'Sorry! You can retry later or report bugs to us if any',

  [REGISTER_STATUS.TAKEOVERED]: 'Address had been taken over, you can register again to take over it',
  [REGISTER_STATUS.TRANSACTION_ERROR]: 'Fail to process transaction, please make sure you have enough ETH',
})

interface IProps {
  userStore: UserStore
  getRetry: (retry: () => void) => void
  onRegisterCompleted?: () => void
  onStatusChanged: (currentStatus: REGISTER_STATUS) => void
}

interface IState {
  status: REGISTER_STATUS
}

export default AccountRegisterStatus
