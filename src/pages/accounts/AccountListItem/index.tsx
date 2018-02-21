import * as React from 'react'
import {
  Link,
} from 'react-router-dom'

// component
import {
  List,
  Button,
  Spin,
  Icon,
  Tooltip,
  Popconfirm,
  message,
} from 'antd'
import HashAvatar from '../../../components/HashAvatar'

// style
import * as styles from './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../../stores'
import {
  MetaMaskStore,
  ETHEREUM_NETWORK_TX_URL_PREFIX,
} from '../../../stores/MetaMaskStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
} from '../../../stores/UsersStore'
import {
  UserStore,
  IUser,
  USER_STATUS,
  IDENTITY_UPLOAD_CHECKING_FAIL_CODE,
} from '../../../stores/UserStore'

// helper
import {
  storeLogger,
} from '../../../utils/loggers'

@inject(mapStoreToProps)
@observer
class AccountListItem extends React.Component<IProps, IState> {
  public readonly state = Object.freeze({
    status: REGISTER_STATUS.PENDING,
    helpMessage: '',
    isDeleting: false,
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public componentDidMount() {
    const {
      isRegisterCompleted,
      user,
    } = this.injectedProps.userStore
    if (!isRegisterCompleted) {
      this.handleCheckRegisterStatus()
    } else {
      this.setState({
        status: (() => {
          switch (user.status) {
            case USER_STATUS.OK:
              return REGISTER_STATUS.DONE
            case USER_STATUS.FAIL:
              return REGISTER_STATUS.TRANSACTION_ERROR
            default:
              return REGISTER_STATUS.UNEXCEPTED_ERROR
          }
        })(),
      })
    }
  }

  public render() {
    const {
      avatarHash,
      user,
    } = this.injectedProps.userStore
    const {
      isCurrentUser,
    } = this.injectedProps.usersStore

    return (
      <List.Item
        actions={this.getActions()}
      >
        <List.Item.Meta
          avatar={<HashAvatar
            shape="circle"
            hash={avatarHash}
          />}
          title={
            <Link to={`/profile${isCurrentUser(user.networkId, user.userAddress) ? '' : `/${user.userAddress}`}`}>
              {user.userAddress}
            </Link>}
        />
        <div className={styles.listContent}>
          {this.getListContent()}
        </div>
      </List.Item>
    )
  }

  private getActions = () => {
    const {
      user,
    } = this.injectedProps.userStore
    const {
      isCurrentUser,
    } = this.injectedProps.usersStore
    const {
      status,
      isDeleting,
    } = this.state

    const deleteButton = (
      <Popconfirm
        title="Are you sure delete this user?"
        onConfirm={this.handleDeleteUser}
        okText="Delete"
        okType="danger"
      >
        <Button
          key={`delete-${user.userAddress}`}
          loading={isDeleting}
          size="large"
          type="danger"
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Popconfirm>
    )

    switch (status) {
      case REGISTER_STATUS.DONE:
        if (isCurrentUser(user.networkId, user.userAddress)) {
          return [
            deleteButton,
          ]
        }
        return [
          <Button
            key={`switch-${user.userAddress}`}
            size="large"
            type="primary"
            onClick={this.handleSwitchUser}
          >
            Switch
          </Button>,
          deleteButton,
        ]
      case REGISTER_STATUS.TIMEOUT:
      case REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL:
      case REGISTER_STATUS.UNEXCEPTED_ERROR:
        return [
          <Button
            key={`retry-${user.userAddress}`}
            size="large"
            type="primary"
            onClick={this.handleCheckRegisterStatus}
          >
            Retry
          </Button>,
          deleteButton,
        ]
      case REGISTER_STATUS.TRANSACTION_ERROR:
      default:
        return [
          deleteButton,
        ]
    }
  }

  private getListContent = () => {
    const {
      user,
    } = this.props
    const {
      status,
      helpMessage,
    } = this.state
    const {
      currentEthereumNetwork,
    } = this.injectedProps.metaMaskStore
    const {
      isCurrentUser,
    } = this.injectedProps.usersStore

    const statusIconClassNames = styles.statusIcon

    switch (status) {
      case REGISTER_STATUS.PENDING:
        return <Spin />
      case REGISTER_STATUS.IDENTITY_UPLOADING:
      case REGISTER_STATUS.TRANSACTION_ERROR:
        return (
          <Tooltip title={helpMessage} placement="bottom">
            <a
              className={styles.transactionLink}
              target="_blank"
              href={`${ETHEREUM_NETWORK_TX_URL_PREFIX[currentEthereumNetwork!] || '#'}${user.identityTransactionHash}`}
            >
              <Icon className={statusIconClassNames} type={REGISTER_STATUS_ICON_TYPE[status]} />
              <span>{REGISTER_STATUS_SUMMARY_TEXT[status]}</span>
            </a>
          </Tooltip>
        )
      case REGISTER_STATUS.IDENTITY_UPLOADED:
      case REGISTER_STATUS.TIMEOUT:
      case REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL:
      case REGISTER_STATUS.UNEXCEPTED_ERROR:
      case REGISTER_STATUS.OCCUPIED:
        return (
          <Tooltip title={helpMessage} placement="bottom">
            <Icon className={statusIconClassNames} type={REGISTER_STATUS_ICON_TYPE[status]} />
            <span>{REGISTER_STATUS_SUMMARY_TEXT[status]}</span>
          </Tooltip>
        )
      case REGISTER_STATUS.DONE:
      default:
        if (isCurrentUser(user.networkId, user.userAddress)) {
          return 'Current user'
        }
        return null
    }
  }

  private handleDeleteUser = async () => {
    const {
      userAddress,
      networkId,
    } = this.props.user
    this.setState({
      isDeleting: true,
    })
    await this.injectedProps.usersStore.deleteUser(networkId, userAddress)
    this.setState({
      isDeleting: false,
    })
  }

  private handleSwitchUser = () => {
    this.injectedProps.usersStore.useUser(this.props.user)
  }

  private handleCheckRegisterStatus = () => {
    const {
      checkIdentityUploadStatus,
    } = this.injectedProps.userStore
    checkIdentityUploadStatus({
      checkIdentityUploadStatusWillStart: this.checkIdentityUploadStatusWillStart,
      identityDidUpload: this.identityDidUpload,
      registerDidFail: this.registerDidFail,
      checkingDidFail: this.identityUploadCheckingDidFail,
    }).catch(this.identityUploadCheckingDidFail)
  }

  private checkIdentityUploadStatusWillStart = () => {
    if (this.unmounted) {
      return
    }

    this.setState({
      status: REGISTER_STATUS.IDENTITY_UPLOADING,
      helpMessage: 'Transaction processing',
    })
  }

  private identityDidUpload = () => {
    if (this.unmounted) {
      return
    }

    this.injectedProps.userStore.uploadPreKeys({
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail,
      isRegister: true,
    }).catch(this.preKeysUploadDidFail)

    this.setState({
      status: REGISTER_STATUS.IDENTITY_UPLOADED,
      helpMessage: 'Uploading pre-keys to cloud server',
    })
  }

  private preKeysDidUpload = async () => {
    if (this.unmounted) {
      return
    }

    const {
      users,
      useUser,
    } = this.injectedProps.usersStore

    if (users.length === 1) {
      await useUser(this.props.user)
      message.success('You have successfully registered and logged in!')
    }

    this.setState({
      status: REGISTER_STATUS.DONE,
    })
  }

  private preKeysUploadDidFail = (err: Error) => {
    if (this.unmounted) {
      return
    }

    storeLogger.error(err)

    this.setState({
      status: REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL,
      helpMessage: 'Can not upload your public keys to our server, please check your internet connection and retry',
    })
  }

  private registerDidFail = (code: REGISTER_FAIL_CODE) => {
    if (this.unmounted) {
      return
    }

    let status: REGISTER_STATUS
    let helpMessage: string
    switch (code) {
      case REGISTER_FAIL_CODE.OCCUPIED:
        status = REGISTER_STATUS.OCCUPIED
        helpMessage = 'Wallet address already registered.'
        break
      case REGISTER_FAIL_CODE.TRANSACTION_ERROR:
        status = REGISTER_STATUS.TRANSACTION_ERROR
        helpMessage = 'Transaction process error, you can delete this account and retry later.'
        break
      default:
        status = REGISTER_STATUS.UNEXCEPTED_ERROR
        helpMessage = `Something went wrong, you can retry later.`
    }
    this.setState({
      status,
      helpMessage,
    })
  }

  private identityUploadCheckingDidFail = (err: Error | null, code = IDENTITY_UPLOAD_CHECKING_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }

    let status: REGISTER_STATUS
    let helpMessage: string
    switch (code) {
      case IDENTITY_UPLOAD_CHECKING_FAIL_CODE.TIMEOUT:
        status = REGISTER_STATUS.TIMEOUT
        helpMessage = `Transaction was not mined within 50 blocks, you can retry later.`
        break
      default:
        status = REGISTER_STATUS.UNEXCEPTED_ERROR
        helpMessage = `Something went wrong, you can retry later.`
    }
    this.setState({
      status,
      helpMessage,
    })
  }
}

function mapStoreToProps(
  {
    metaMaskStore,
    usersStore,
  }: IStores,
  props: IProps,
): IInjectedProps {
  const {
    user,
  } = props
  return {
    metaMaskStore,
    usersStore,
    userStore: usersStore.getUserStore(user),
  }
}

// constant
enum REGISTER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADING,
  IDENTITY_UPLOADED,
  DONE,
  // warn
  TIMEOUT,
  UPLOAD_PRE_KEYS_FAIL,
  UNEXCEPTED_ERROR,
  // error
  OCCUPIED,
  TRANSACTION_ERROR,
}

const REGISTER_STATUS_SUMMARY_TEXT = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'Uploading identity',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'Uploading keys',

  [REGISTER_STATUS.TIMEOUT]: 'Timeout',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'Upload keys fail',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'Unexpected error',

  [REGISTER_STATUS.OCCUPIED]: 'Be occupied',
  [REGISTER_STATUS.TRANSACTION_ERROR]: 'Transaction error',
}) as {
  [status: number]: string,
}

const REGISTER_STATUS_ICON_TYPE = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'loading',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'loading',

  [REGISTER_STATUS.TIMEOUT]: 'exclamation-circle-o',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'exclamation-circle-o',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'exclamation-circle-o',

  [REGISTER_STATUS.OCCUPIED]: 'close-circle-o',
  [REGISTER_STATUS.TRANSACTION_ERROR]: 'close-circle-o',
}) as {
  [status: number]: string,
}

// typing
interface IProps {
  user: IUser
  className?: string
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
  userStore: UserStore
}

interface IState {
  status: REGISTER_STATUS
  isDeleting: boolean
  helpMessage: string
}

export default AccountListItem
