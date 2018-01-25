import * as React from 'react'
import {
  withRouter,
  RouteComponentProps,
  Redirect,
} from 'react-router-dom'

import {
  inject,
  observer,
} from 'mobx-react'

import {
  EthereumStore,
  UsersStore,
  Istores,
} from '../../stores'

import CommonHeaderPage from '../../containers/CommonHeaderPage'

import {
  Divider,
  Button,
  Icon,
  Upload,
  message,
} from 'antd'

import {
  storeLogger,
  getBEMClassNamesMaker
} from '../../utils'

import {
  ETHEREUM_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
} from '../../constants'

import { UploadFile } from 'antd/lib/upload/interface.d'

import './index.css'

const {
  Dragger
} = Upload

type Iprops = RouteComponentProps<{}>

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  registerButtonContent: string
  isRegistering: boolean
  isImporting: boolean
}

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

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(Register.blockName, this.props)

  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {
      ethereumStore: {
        ethereumConnectStatus,
        currentEthereumAccount
      },
      usersStore: {
        canCreateOrImportUser
      }
    } = this.injectedProps
    const {
      getBEMClassNames,
      state: {
        registerButtonContent
      }
    } = this
    const isPending = ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.PENDING

    if (!isPending && !canCreateOrImportUser) {
      return <Redirect to="/" />
    }

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
          if ((err as Error).message.includes('User denied transaction signature')) {
            return 'Register fail, you reject the transaction.'
          }
        // tslint:disable-next-line no-switch-case-fall-through
        default:
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
      // await this.injectedProps.usersStore.restoreDumpedUser(
      //   (oFREvent.target as any).result,
      //   false
      // )
      if (this.injectedProps.location.pathname === '/register') {
        this.injectedProps.history.push('/')
      }
    }
    reader.readAsText(file)
    return false
  }
}

export default withRouter(Register)
