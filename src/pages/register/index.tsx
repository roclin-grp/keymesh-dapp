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
} from 'antd'
import CommonHeaderPage from '../../containers/CommonHeaderPage'
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
  Istores,
} from '../../stores'
import {
  EthereumStore,
} from '../../stores/EthereumStore'
import {
  REGISTER_FAIL_CODE,
  UsersStore,
} from '../../stores/UsersStore'

// helper
import {
  storeLogger,
} from '../../utils/loggers'
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class Register extends React.Component<Iprops, Istate> {
  public static readonly blockName = 'register'

  public readonly state = Object.freeze({
    registerButtonContent: 'Register',
    isRegistering: false,
    isImporting: false
  })

  private readonly injectedProps = this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(Register.blockName, this.props)

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {
      ethereumStore: {
        currentEthereumAccount
      },
    } = this.injectedProps
    const {
      getBEMClassNames,
      state: {
        registerButtonContent
      }
    } = this

    return (
      <CommonHeaderPage prefixClass={Register.blockName} className={getBEMClassNames()}>
        <h2 className={getBEMClassNames('title', {}, { title: true })}>
          Register new account
        </h2>
        <h3>
          Wallet Address: {currentEthereumAccount}
        </h3>
        <p>Click the button below and confirm the transaction to create a new account</p>
        <Button
          loading={this.state.isRegistering}
          size="large"
          type="primary"
          disabled={this.state.isRegistering}
          onClick={this.handleRegister}
        >
          {registerButtonContent}
        </Button>
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
      </CommonHeaderPage>
    )
  }

  private handleRegister = () => {
    this.setState({
      isRegistering: true,
      registerButtonContent: 'Checking...'
    })

    this.injectedProps.usersStore.register({
      transactionWillCreate: this.transactionWillCreate,
      registerDidFail: this.registerDidFail,
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

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    message.error((() => {
      switch (code) {
        case REGISTER_FAIL_CODE.OCCUPIED:
          return `User address already registered.`
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
      isRegistering: false
    })
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
type Iprops = {}

interface IinjectedProps extends RouteComponentProps<{}> {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  registerButtonContent: string
  isRegistering: boolean
  isImporting: boolean
}

export default Register
