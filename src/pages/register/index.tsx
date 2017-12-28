import * as React from 'react'

import { withRouter,  } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE
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
  REGISTERED
} = REGISTER_FAIL_CODE

interface Iprops {
  history: {
    replace: (path: string) => void
  }
  store: Store
}

interface Istate {
  registerProgress: string,
  isRegistering: boolean
}

@inject('store') @observer
class Register extends React.Component<Iprops, Istate> {
  public readonly state = {
    registerProgress: '',
    isRegistering: false
  }
  private unmounted = false
  public componentWillUnmount() {
    this.unmounted = true
  }
  public render() {
    const {
      connectStatus,
      connectError,
      currentEthereumAccount,
    } = this.props.store

    switch (connectStatus) {
      case PENDING:
        return <div>
          <HeaderWithStore />
          <div
            style={{
              textAlign: 'center'
            }}
          >
            <pre>Connecting to trustbase...</pre>
          </div>
        </div>
      case OFFLINE:
        return <div>
          <HeaderWithStore />
          <div
            style={{
              textAlign: 'center'
            }}
          >
            <pre>You are offline!</pre>
          </div>
        </div>
      case NO_ACCOUNT: {
        return <div>
          <HeaderWithStore />
          <div
            style={{
              textAlign: 'center'
            }}
          >
            <pre>Found no Ethereum account. (You may need to unlock MetaMask.)</pre>
          </div>
        </div>
      }
      case SUCCESS: {
        return <div>
          <HeaderWithStore />
          <div
            style={{
              textAlign: 'center'
            }}
          >
            <pre>Register new account</pre>
            <p>Wallet Address: {currentEthereumAccount}</p>
            <button disabled={this.state.isRegistering} onClick={this.handleRegister}>Register</button>
            <pre>{this.state.registerProgress}</pre>
            <RegisterRecordsWithStore />
          </div>
        </div>
      }
      case CONTRACT_ADDRESS_ERROR:
      case ERROR:
        return <div>
          <HeaderWithStore />
          <div
            style={{
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
            }}
          >
            <pre>Something was gone wrong!</pre>
            <pre>{connectError.stack}</pre>
          </div>
        </div>
      default:
        return null
    }
  }

  private handleRegister = () => {
    const {
      register
    } = this.props.store

    this.setState({
      isRegistering: true
    })

    register({
      transactionWillCreate: this.transactionWillCreate,
      transactionDidCreate: this.transactionDidCreate,
      userDidCreate: this.userDidCreate,
      registerDidFail: this.registerDidFail,
    })
      .catch(this.registerDidFail)
  }
  private transactionWillCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerProgress: `Creating transaction...
(You may need to confirm the transaction.)`
    })
  }
  private transactionDidCreate = (hash: string) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerProgress: `Transaction created (hash: ${hash}).
Creating account...`
    })
  }
  private userDidCreate = () => {
    if (this.unmounted) {
      return
    }
    this.props.history.replace('/check-register')
  }
  private registerDidFail = (err: Error | null, code = UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerProgress: (() => {
        switch (code) {
          case UNKNOWN:
            return (err as Error).toString()
          case FOUND_ON_LOCAL:
            return `Found identity on local`
          case REGISTERED:
            return `User address already registered.`
          default:
            return 'other'
        }
      })(),
      isRegistering: false
    })
  }
}

export default withRouter(Register as any)
