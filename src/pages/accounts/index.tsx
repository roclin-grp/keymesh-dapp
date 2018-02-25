import * as React from 'react'
import {
  RouteComponentProps,
} from 'react-router-dom'

// component
import {
  Divider,
  Button,
  Icon,
  Upload,
  message,
  List,
} from 'antd'
import AccountListItem from './AccountListItem'
import {
  UploadFile,
} from 'antd/lib/upload/interface.d'
const {
  Dragger,
} = Upload

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
  IUser,
} from '../../stores/UserStore'

// helper
import {
  storeLogger,
} from '../../utils/loggers'

@inject(({
  metaMaskStore,
  usersStore,
}: IStores) => ({
  metaMaskStore,
  usersStore,
}))
@observer
class Accounts extends React.Component<IProps, IState> {
  public readonly state = Object.freeze({
    registerButtonContent: 'Register',
    isCreatingTransaction: false,
    isImporting: false,
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    return (
      <div className={classnames(styles.container, 'page-content')}>
        {this.renderManageAccounts()}
        <h3>
          Wallet Address: {this.injectedProps.metaMaskStore.currentEthereumAccount}
        </h3>
        {this.renderCreateAccount()}
        {this.renderSwitchToCorrespondingAccount()}
        <div className="container">
          <Divider />
        </div>
        <h2 className="title">
          Import account
        </h2>
        <Dragger
          className="container"
          action="/"
          beforeUpload={this.handleImport}
          accept=".json"
          disabled={this.state.isImporting}
        >
          <div className={styles.draggerInner} >
            <p className="ant-upload-drag-icon">
              <Icon type="plus" />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to import
            </p>
            <p className="ant-upload-hint">
              Support JSON format exported user data
            </p>
          </div>
        </Dragger>
      </div>
    )
  }

  private renderManageAccounts() {
    const { users } = this.injectedProps.usersStore
    if (users.length === 0) {
      return (
        <h2 className="title">
          Create new account
        </h2>
      )
    }

    return (
      <>
        <h2 className="title">
          Manage accounts
        </h2>
        <div className={classnames(styles.userListContainer, 'container')}>
          <List
            rowKey={((user: IUser) => user.userAddress)}
            dataSource={users}
            renderItem={(user: IUser) => (
              <AccountListItem user={user} />
            )}
          />
        </div>
      </>
    )
  }

  private renderCreateAccount() {
    const {
      isCreatingTransaction,
      registerButtonContent,
    } = this.state
    const {
      hasRegisterRecordOnLocal,
      hasRegisterRecordOnChain,
    } = this.injectedProps.usersStore

    if (hasRegisterRecordOnLocal) {
      return null
    }

    if (hasRegisterRecordOnChain) {
      return <p>This address already registered, please use another wallet address or import existed account.</p>
    }

    return (
      <>
        <p>Click the button below and confirm the transaction to create a new account</p>
        <Button
          loading={isCreatingTransaction}
          size="large"
          type="primary"
          disabled={isCreatingTransaction}
          onClick={this.handleRegister}
        >
          {registerButtonContent}
        </Button>
      </>
    )
  }

  private renderSwitchToCorrespondingAccount() {
    const { currentEthereumNetwork, currentEthereumAccount } = this.injectedProps.metaMaskStore
    const {
      isCurrentUser,
      hasWalletCorrespondingUsableUser,
    } = this.injectedProps.usersStore

    const isUsingAlready = isCurrentUser(currentEthereumNetwork!, currentEthereumAccount!)
    if (isUsingAlready || !hasWalletCorrespondingUsableUser) {
      return null
    }

    return (
      <>
        <p>Would you like to swtich to corresponding account?</p>
        <Button
          size="large"
          type="primary"
          onClick={this.handleSwitchToRespondingAccount}
        >
          Switch
        </Button>
      </>
    )
  }

  private handleRegister = () => {
    this.setState({
      isCreatingTransaction: true,
      registerButtonContent: 'Checking...',
    })

    this.injectedProps.usersStore.register({
      transactionWillCreate: this.transactionWillCreate,
      registerDidFail: this.registerDidFail,
      transactionDidCreate: this.transactionDidCreate,
    })
      .catch(this.registerDidFail)
  }

  private transactionWillCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerButtonContent: 'Please confirm the transaction...',
    })
  }

  private transactionDidCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerButtonContent: 'Register',
      isCreatingTransaction: false,
    })
  }

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    message.error((() => {
      switch (code) {
        case REGISTER_FAIL_CODE.OCCUPIED:
          return `Wallet address already registered.`
        case REGISTER_FAIL_CODE.UNKNOWN:
        default:
          if ((err as Error).message.includes('User denied transaction signature')) {
            return 'Register fail, you reject the transaction.'
          }
          storeLogger.error('Unexpected register error:', err as Error)
          return 'Something went wrong, please retry.'
      }
    })())
    this.setState({
      registerButtonContent: 'Register',
      isCreatingTransaction: false,
    })
  }

  private handleSwitchToRespondingAccount = () => {
    const {
      useUser,
      walletCorrespondingUser,
    } = this.injectedProps.usersStore
    useUser(walletCorrespondingUser!)
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
        if (!this.unmounted) {
          if (this.injectedProps.usersStore.users.length === 1) {
            await this.injectedProps.usersStore.useUser(user)
            message.success('You have successfully imported account and logged in!')
          } else {
            message.success('Account imported successfully')
          }
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

// typing
interface IProps {}

interface IInjectedProps extends RouteComponentProps<{}> {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

interface IState {
  registerButtonContent: string
  isCreatingTransaction: boolean
  isImporting: boolean
}

export default Accounts
