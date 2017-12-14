import * as React from 'react'

import { withRouter } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  NETWORKS
} from '../../constants'

import Header from '../../containers/header'
import RegisterRecords from '../../containers/register-records'

import './index.css'

const HeaderWithStore = Header as any
const RegisterRecordsWithStore = RegisterRecords as any

const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

const {
  UNKNOWN,
  FOUND_ON_LOCAL,
  OCCUPIED,
  TIMEOUT
} = REGISTER_FAIL_CODE

interface Iprops {
  store: Store
  history: {
    push: (path: string) => void
    replace: (path: string) => void
  }
  match: {
    params: {
      networkId?: string
      usernameHash?: string
    }
  }
}

interface Istate {
  registerProgress: string
}

@inject('store') @observer
class CheckRegister extends React.Component<Iprops, Istate> {
  public readonly state = {
    registerProgress: ''
  }
  public componentDidMount() {
    const {
      store: {
        connectStatus,
        checkRegister,
        listenForConnectStatusChange,
        currentEthereumNetwork
      },
      match: {
        params: {
          networkId,
          usernameHash
        }
      },
      history
    } = this.props
    if (
      typeof currentEthereumNetwork !== 'undefined'
      && Number(networkId) !== currentEthereumNetwork
    ) {
      return history.replace(`/check-register/${currentEthereumNetwork}`)
    }
    if (
      connectStatus === SUCCESS
      && typeof networkId !== 'undefined'
      && typeof usernameHash !== 'undefined'
    ) {
      checkRegister(Number(networkId), usernameHash, {
        checkRegisterWillStart: this.checkRegisterWillStart,
        accountWillCreate: this.accountWillCreate,
        accountDidCreate: this.accountDidCreate,
        preKeysDidUpload: this.preKeysDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
    listenForConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    const {
      removeConnectStatusListener,
      clearStoreRegisterRecords
    } = this.props.store
    clearStoreRegisterRecords()
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      store: {
        connectStatus,
        connectError
      },
      match: {
        params: {
          usernameHash
        }
      }
    } = this.props
    switch (connectStatus) {
      case PENDING:
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            <pre>Connecting to trustbase...</pre>
          </div>
        </div>
      case OFFLINE:
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            <pre>You are offline!</pre>
          </div>
        </div>
      case NO_ACCOUNT: {
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            <pre>Found no Ethereum account. (You may need to unlock MetaMask.)</pre>
          </div>
        </div>
      }
      case SUCCESS: {
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            {typeof usernameHash !== 'undefined'
              ? <pre>{this.state.registerProgress}</pre>
              : <RegisterRecordsWithStore />
            }
          </div>
        </div>
      }
      case CONTRACT_ADDRESS_ERROR:
      case ERROR:
        return <div>
          <HeaderWithStore />
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'fixed',
            backgroundColor: '#ff6464',
            width: '100%',
            height: '100%',
            top: 0,
            marginTop: 50,
            paddingTop: 20,
            color: 'white'
          }}>
            <pre>Something was gone wrong!</pre>
            <pre>{connectError.stack}</pre>
          </div>
        </div>
      default:
        return null
    }
  }
  private checkRegisterWillStart = (hash: string) => {
    this.setState({
      registerProgress: `Waiting for trustbase identity register... (hash: ${hash})`
    })
  }

  private accountWillCreate = () => {
    this.setState({
      registerProgress: `Trustbase registered.
Creating local account...`
    })
  }
  private accountDidCreate = () => {
    this.setState({
      registerProgress: `Local account created.`
    })
  }
  private preKeysDidUpload = () => {
    this.setState({
      registerProgress: `Pre-keys uploaded.
Redirect to homepage in 5 sec`
    })
    window.setTimeout(() => {
      this.props.history.push('/')
    }, 5000)
  }
  private registerDidFail = (err: Error | null, code = UNKNOWN) => {
    this.setState({
      registerProgress: (() => {
        switch (code) {
          case UNKNOWN:
            return (err as Error).toString()
          case FOUND_ON_LOCAL:
            return `Found identity on local`
          case OCCUPIED:
            return `Username already registered. Try another account name.`
          case TIMEOUT:
            return `Transaction was not mined within 50 blocks, you can refresh the page to retry.`
          default:
            return 'other'
        }
      })()
    })
  }
  private connectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => {
    const {
      store: {
        checkRegister,
        currentEthereumNetwork
      },
      match: {
        params: {
          networkId,
          usernameHash
        }
      },
      history
    } = this.props
    if (
      typeof currentEthereumNetwork !== 'undefined'
      && Number(networkId) !== currentEthereumNetwork
    ) {
      return history.replace(`/check-register/${currentEthereumNetwork}`)
    }
    if (
      typeof usernameHash !== 'undefined'
      && prev !== SUCCESS
      && cur === SUCCESS
    ) {
      checkRegister(Number(networkId) as NETWORKS, usernameHash as string, {
        checkRegisterWillStart: this.checkRegisterWillStart,
        accountWillCreate: this.accountWillCreate,
        accountDidCreate: this.accountDidCreate,
        preKeysDidUpload: this.preKeysDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
  }
}

export default withRouter(CheckRegister as any)
