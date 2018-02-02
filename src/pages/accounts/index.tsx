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
import AccountListItem from '../../components/AccountListItem'
import {
  UploadFile,
} from 'antd/lib/upload/interface.d'
const {
  Dragger
} = Upload

// style
import './index.css'

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
  IUser
} from '../../stores/UserStore'

// helper
import {
  storeLogger,
} from '../../utils/loggers'
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

@inject(({
  metaMaskStore,
  usersStore
}: IStores) => ({
  metaMaskStore,
  usersStore
}))
@observer
class Accounts extends React.Component<IProps, IState> {
  public static readonly blockName = 'accounts'

  public readonly state = Object.freeze({
    registerButtonContent: 'Register',
    isCreatingTransaction: false,
    isImporting: false
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(Accounts.blockName, this.props)

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {getBEMClassNames} = this
    const {
      metaMaskStore: {
        currentEthereumAccount,
      },
      usersStore: {
        users,
        currentUserStore,
        hasNoRegisterRecordOnLocal,
        hasNoRegisterRecordOnChain,
        hasWalletCorrespondingUsableUser,
      },
    } = this.injectedProps
    const {
      isCreatingTransaction,
      registerButtonContent,
    } = this.state

    return (
      <>
        {
          users.length === 0
          ? (
            <h2 className={getBEMClassNames('title', {}, { title: true })}>
              Create new account
            </h2>
          )
          : this.getUserList()
        }
        <h3>
          Wallet Address: {currentEthereumAccount}
        </h3>
        {
          hasNoRegisterRecordOnLocal && hasNoRegisterRecordOnChain
          ? (
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
          : null
        }
        {
          hasNoRegisterRecordOnLocal && !hasNoRegisterRecordOnChain
          ? <p>This address already registered, please use another wallet address or import existed account.</p>
          : null
        }
        {
          hasWalletCorrespondingUsableUser
          && !currentUserStore!.isCorrespondingEthereumAddressAccount
          ? (
            <>
              <p>Would you like to swtich to corresponding account?</p>
              <Button
                size="large"
                type="primary"
                onClick={this.handleSwitch}
              >
                Switch
              </Button>
            </>
          )
          : null
        }
        <Divider className={getBEMClassNames('divider', {}, { container: true })} />
        <h2 className={getBEMClassNames('title', {}, { title: true })}>
          Import account
        </h2>
        <Dragger
          className={getBEMClassNames('import', {}, { container: true })}
          action="/"
          beforeUpload={this.handleImport}
          accept=".json"
          disabled={this.state.isImporting}
        >
          <p className="ant-upload-drag-icon">
            <Icon type="plus" />
          </p>
          <p className="ant-upload-text">Click or drag file to this area to import</p>
          <p className="ant-upload-hint">
            Support JSON format exported user data
          </p>
        </Dragger>
      </>
    )
  }

  private getUserList() {
    const {getBEMClassNames} = this
    const {
      usersStore: {
        users,
      },
    } = this.injectedProps
    return (
      <>
        <h2 className={getBEMClassNames('title', {}, { title: true })}>
          Manage accounts
        </h2>
        <div className={getBEMClassNames('user-list-container', {}, { container: true })}>
          <List
            dataSource={users}
            renderItem={(user: IUser) => (
              <AccountListItem key={user.userAddress} user={user} />
            )}
          />
        </div>
      </>
    )
  }

  private handleRegister = () => {
    this.setState({
      isCreatingTransaction: true,
      registerButtonContent: 'Checking...'
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
      registerButtonContent: 'Please confirm the transaction...'
    })
  }

  private transactionDidCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerButtonContent: 'Register',
      isCreatingTransaction: false
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
      isCreatingTransaction: false
    })
  }

  private handleSwitch = () => {
    const {
      usableUsers,
      useUser,
    } = this.injectedProps.usersStore
    const {
      currentEthereumAccount,
    } = this.injectedProps.metaMaskStore
    useUser(usableUsers.find((user) => user.userAddress === currentEthereumAccount)!)
  }

  private handleImport = (_: UploadFile, files: UploadFile[]) => {
    if (files.length === 0) {
      return false
    }
    this.setState({
      isImporting: true
    })
    const file: File = files[0] as any
    const reader = new FileReader()
    reader.onload = async (oFREvent) => {
      try {
        await this.injectedProps.usersStore.importUser((oFREvent.target as any).result)
        if (!this.unmounted) {
          message.success('Account imported!')
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
        if (this.unmounted) {
          return
        }
        this.setState({
          isImporting: false
        })
      }
    }
    reader.readAsText(file)
    return false
  }
}

// typing
type IProps = {}

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
