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
} from 'antd'
import HashAvatar from '../../components/HashAvatar'

// style
import * as styles from './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../stores'
import {
  MetaMaskStore,
  ETHEREUM_NETWORK_TX_URL_PREFIX,
} from '../../stores/MetaMaskStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
} from '../../stores/UsersStore'
import {
  IUser,
} from '../../stores/UserStore'

// helper
import {
  storeLogger
} from '../../utils/loggers'

@inject(({
  usersStore,
  metaMaskStore,
}: IStores) => ({
  usersStore,
  metaMaskStore,
}))
@observer
class AccountListItem extends React.Component<IProps, IState> {
  public readonly state = Object.freeze({
    status: REGISTER_STATUS.PENDING,
    helpMessage: '',
    isDeleting: false
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private userStore = this.injectedProps.usersStore.createUserStore(this.props.user)

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public componentDidMount() {
    const {
      isRegisterCompleted,
    } = this.userStore
    if (!isRegisterCompleted) {
      this.handleCheckRegisterStatus()
    } else {
      this.setState({
        status: REGISTER_STATUS.DONE
      })
    }
  }

  public render() {
    const {
      avatarHash,
      user
    } = this.userStore
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
          title={<Link to={`/profile${isCurrentUser(user) ? '' : `/${user.userAddress}`}`}>{user.userAddress}</Link>}
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
    } = this.userStore
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
        if (isCurrentUser(user)) {
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
          deleteButton
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
          deleteButton
        ]
      default:
        return [
          deleteButton,
        ]
    }
  }

  private getListContent = () => {
    const {
      user
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
        return (
          <Tooltip title={helpMessage} placement="bottom">
            <a
              className={styles.transactionLink}
              target="_blank"
              href={`${ETHEREUM_NETWORK_TX_URL_PREFIX[currentEthereumNetwork!]}${user.identityTransactionHash}`}
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
      default:
        if (isCurrentUser(user)) {
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
      isDeleting: true
    })
    await this.injectedProps.usersStore.deleteUser(networkId, userAddress)
    this.setState({
      isDeleting: false
    })
  }

  private handleSwitchUser = () => {
    const {
      useUser
    } = this.injectedProps.usersStore

    useUser(this.props.user)
  }

  private handleCheckRegisterStatus = () => {
    const {
      checkIdentityUploadStatus,
    } = this.userStore
    checkIdentityUploadStatus({
      checkRegisterWillStart: this.checkRegisterWillStart,
      identityDidUpload: this.identityDidUpload,
      registerDidFail: this.registerDidFail
    }).catch(this.registerDidFail)
  }

  private checkRegisterWillStart = () => {
    if (this.unmounted) {
      return
    }

    this.setState({
      status: REGISTER_STATUS.IDENTITY_UPLOADING,
      helpMessage: 'Waiting for confirmation (click to see transaction)'
    })
  }

  private identityDidUpload = () => {
    if (this.unmounted) {
      return
    }

    this.userStore.uploadPreKeys({
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail,
      isRegister: true
    }).catch(this.preKeysUploadDidFail)

    this.setState({
      status: REGISTER_STATUS.IDENTITY_UPLOADED,
      helpMessage: 'Uploading pre-keys to cloud server.'
    })
  }

  private preKeysDidUpload = async () => {
    if (this.unmounted) {
      return
    }

    const {
      users,
      useUser
    } = this.injectedProps.usersStore

    if (users.length === 1) {
      useUser(this.props.user)
    }

    this.setState({
      status: REGISTER_STATUS.DONE
    })
  }

  private preKeysUploadDidFail = (err: Error) => {
    if (this.unmounted) {
      return
    }

    storeLogger.error(err)

    this.setState({
      status: REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL,
      helpMessage: 'Can not upload your public keys to our server, please check your internet connection and retry.'
    })
  }

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
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
      case REGISTER_FAIL_CODE.TIMEOUT:
        status = REGISTER_STATUS.TIMEOUT
        helpMessage = `Transaction was not mined within 50 blocks, you can retry later.`
        break
      default:
        status = REGISTER_STATUS.UNEXCEPTED_ERROR
        helpMessage = `Something went wrong, you can retry later.`
    }
    this.setState({
      status,
      helpMessage
    })
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
}

const REGISTER_STATUS_SUMMARY_TEXT = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'Uploading identity',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'Uploading keys',

  [REGISTER_STATUS.TIMEOUT]: 'Timeout',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'Upload keys fail',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'Unexpected error',

  [REGISTER_STATUS.OCCUPIED]: 'Be occupied',
}) as {
  [status: number]: string
}

const REGISTER_STATUS_ICON_TYPE = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'loading',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'loading',

  [REGISTER_STATUS.TIMEOUT]: 'exclamation-circle-o',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'exclamation-circle-o',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'exclamation-circle-o',

  [REGISTER_STATUS.OCCUPIED]: 'close-circle-o',
}) as {
  [status: number]: string
}

// typing
interface IProps {
  user: IUser
  className?: string
}

interface IInjectedProps extends IProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

interface IState {
  status: REGISTER_STATUS
  isDeleting: boolean
  helpMessage: string
}

export default AccountListItem
