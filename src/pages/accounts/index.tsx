import * as React from 'react'
import {
  RouteComponentProps,
} from 'react-router-dom'

// component
import {
  Divider,
  Icon,
  Upload,
  message,
  List,
  Modal,
  Button,
  Alert,
  Tooltip,
} from 'antd'
import {
  UploadFile,
} from 'antd/lib/upload/interface.d'
import AccountListItem from './AccountListItem'
import UserAddress from '../../components/UserAddress'
import StatusButton from '../../components/StatusButton'

// style
import classnames from 'classnames'
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
} from '../../stores/MetaMaskStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
} from '../../stores/UsersStore'
import {
  IUser, UserStore,
} from '../../stores/UserStore'

// helper
import {
  storeLogger,
} from '../../utils/loggers'
import { sleep } from '../../utils'

@inject(mapStoreToProps)
@observer
class Accounts extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    isCreatingTransaction: false,
    isImporting: false,
    registerStatus: REGISTER_STATUS.DEFAULT,
  }

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const { usersStore, metaMaskStore, userStore } = this.injectedProps
    const { hasRegisterRecordOnLocal, hasRegisterRecordOnChain, walletCorrespondingUser } = usersStore

    return (
      <div className={classnames(styles.container)}>
        <section>
          <h2 className="title">
            Register New Account
          </h2>
          <h3>Account selected in MetaMask</h3>
          {this.renderCurrentAccount(metaMaskStore, walletCorrespondingUser)}
          {this.renderRegisterButton(
            hasRegisterRecordOnLocal,
            hasRegisterRecordOnChain,
            userStore,
          )}
          {this.renderRegisterExtraInfos(hasRegisterRecordOnLocal, hasRegisterRecordOnChain)}
          <Divider />
        </section>
        {this.renderAccountList(usersStore, metaMaskStore)}
        <section>
          <h3 className="title">
            Import Account Backup
          </h3>
          <Upload
            action="/"
            beforeUpload={this.handleImport}
            accept=".json"
            disabled={this.state.isImporting}
          >
            <Button className={styles.uploadButton}>
              <Icon type="upload" />
              Click to Upload
            </Button>
          </Upload>
        </section>
      </div>
    )
  }

  private renderCurrentAccount(
    metaMaskStore: MetaMaskStore,
    walletCorrespondingUser?: IUser,
  ) {
    const currentEthereumAccount = metaMaskStore.currentEthereumAccount!
    if (walletCorrespondingUser == null) {
      return <UserAddress className={styles.userAddress} address={currentEthereumAccount} />
    }

    return <AccountListItem key={walletCorrespondingUser.userAddress} user={walletCorrespondingUser} />
  }

  private renderRegisterButton(
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
    userStore?: UserStore,
  ) {
    const { isCreatingTransaction, registerStatus, registerStatusStr } = this.state

    const canTakeover = !hasRegisterRecordOnLocal && hasRegisterRecordOnChain

    const isRegistering = userStore != null && !userStore.isRegisterCompleted
    let statusType = REGISTER_STATUS_ICON_TYPES[registerStatus]
    let statusContent = registerStatusStr

    if (hasRegisterRecordOnLocal) {
      statusType = 'success'
      statusContent = 'Registered'
    }
    if (isRegistering) {
      statusType = 'loading'
      statusContent = 'Register In Progress'
    }
    return (
      <StatusButton
        className={styles.registerButtonWrapper}
        buttonClassName={styles.registerButton}
        disabled={hasRegisterRecordOnLocal || isCreatingTransaction}
        statusType={statusType}
        statusContent={statusContent}
        onClick={canTakeover ? this.handleConfirmTakeOver : this.handleRegister}
      >
        Register
      </StatusButton>
    )
  }

  private renderRegisterExtraInfos(
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
  ) {
    const { registerStatus } = this.state
    const { extraRegisterInfo } = styles

    if (registerStatus === REGISTER_STATUS.PENDING) {
      return (
        <p className={extraRegisterInfo}>
          Please confirm the transaction in MetaMask.
          {' '}
          <Tooltip title="Click the MetaMask extension icon">
            <Icon type="question-circle-o" />
          </Tooltip>
        </p>
      )
    }

    if (hasRegisterRecordOnLocal) {
      // TODO: help link
      return <a className={extraRegisterInfo}>How to select a different Ethereum address?</a>
    }

    if (hasRegisterRecordOnChain) {
      return (
        <Alert
          message="This address is already registered, register a new account will take over it."
          type="warning"
          showIcon
        />
      )
    }

    return null
  }

  private renderAccountList(
    usersStore: UsersStore,
    metaMaskStore: MetaMaskStore,
  ) {
    const { users } = usersStore
    const currentEthereumAccount = metaMaskStore.currentEthereumAccount!
    const otherUsers = users.filter((user) => user.userAddress !== currentEthereumAccount)
    if (otherUsers.length === 0) {
      return null
    }

    return (
      <section>
        <h2 className="title">
          Sign In to Other Accounts
        </h2>
        <List
          className={styles.otherAccounts}
          rowKey={((user: IUser) => user.userAddress)}
          dataSource={otherUsers}
          renderItem={(user: IUser) => (
            <AccountListItem user={user} />
          )}
        />
        <Divider />
      </section>
    )
  }

  private handleRegister = () => {
    this.setState({
      isCreatingTransaction: true,
      registerStatus: REGISTER_STATUS.CHECKING,
      registerStatusStr: 'Checking...',
    })

    this.injectedProps.usersStore.register({
      transactionWillCreate: this.transactionWillCreate,
      registerDidFail: this.registerDidFail,
      transactionDidCreate: this.transactionDidCreate,
    })
      .catch(this.registerDidFail)
  }

  private handleConfirmTakeOver = () => {
    Modal.confirm({
      title: 'Are you sure take over this address?',
      content: 'After take over, you can NOT use the account currently binding to this address anymore!',
      okText: 'Take over it',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: this.handleRegister,
    })
  }

  private transactionWillCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerStatus: REGISTER_STATUS.PENDING,
      registerStatusStr: 'Pending authorization',
    })
  }

  private transactionDidCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerStatus: REGISTER_STATUS.TRANSACTING,
      registerStatusStr: 'Register In Progress',
      isCreatingTransaction: false,
    })
  }

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerStatus: REGISTER_STATUS.FAILED,
      registerStatusStr: this.getRegisterErrorStr(err, code),
      isCreatingTransaction: false,
    })
  }

  private getRegisterErrorStr(err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) {
    switch (code) {
      case REGISTER_FAIL_CODE.OCCUPIED:
        return `Wallet address already registered.`
      case REGISTER_FAIL_CODE.UNKNOWN:
      default:
        if ((err as Error).message.includes('User denied transaction signature')) {
          return 'Failed to register, you rejected the transaction.'
        }
        storeLogger.error('Unexpected register error:', err as Error)
        return 'Something went wrong, please retry.'
    }
  }

  private handleImport = (_: UploadFile, files: UploadFile[]) => {
    if (files.length === 0) {
      return false
    }
    this.setState({
      isImporting: true,
    })
    const file: File = files[0] as any
    const reader = new FileReader()
    reader.onload = async (oFREvent) => {
      try {
        const user = await this.injectedProps.usersStore.importUser((oFREvent.target as any).result)
        if (this.unmounted) {
          return
        }

        if (this.injectedProps.usersStore.users.length === 1) {
          await this.injectedProps.usersStore.useUser(user)

          this.injectedProps.history.push('/profile')
          await sleep(50)
          message.success('You have successfully imported account and logged in!')

          await sleep(4000)
          message.info('You can now let others know you by proving yourself on social media!')
        } else {
          await sleep(50)
          message.success('Account imported successfully')
        }
      } catch (err) {
        if (this.unmounted) {
          return
        }

        if ((err as Error).message === 'Network not match') {
          message.error('You were trying to import an account not belongs to current network!')
          return
        }

        if ((err as Error).message.includes('Key already exists in the object store')) {
          message.info('You already have this account!')
          return
        }

        storeLogger.error(err)
        message.error('Something went wrong! Please retry.')
      } finally {
        if (!this.unmounted) {
          this.setState({
            isImporting: false,
          })
        }
      }
    }
    reader.readAsText(file)
    return false
  }
}

function mapStoreToProps({
  metaMaskStore,
  usersStore,
}: IStores) {
  const { walletCorrespondingUser } = usersStore
  return {
    metaMaskStore,
    usersStore,
    userStore: walletCorrespondingUser != null ? usersStore.getUserStore(walletCorrespondingUser) : undefined,
  }
}

enum REGISTER_STATUS {
  DEFAULT,
  CHECKING,
  PENDING,
  TRANSACTING,
  SUCCESS,
  FAILED,
  WARN,
}

const REGISTER_STATUS_ICON_TYPES = Object.freeze({
  [REGISTER_STATUS.CHECKING]: 'loading',
  [REGISTER_STATUS.PENDING]: 'loading',
  [REGISTER_STATUS.TRANSACTING]: 'loading',
  [REGISTER_STATUS.SUCCESS]: 'success',
  [REGISTER_STATUS.FAILED]: 'error',
  [REGISTER_STATUS.WARN]: 'warn',
})

// typing
interface IProps {}

interface IInjectedProps extends RouteComponentProps<{}> {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
  userStore?: UserStore
}

interface IState {
  registerStatus: REGISTER_STATUS
  registerStatusStr?: string
  isCreatingTransaction: boolean
  isImporting: boolean
}

export default Accounts
