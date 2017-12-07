import * as React from 'react'

import { withRouter,  } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import './register.css'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE
} from '../../constants'

import Header from '../../containers/header'

const HeaderWithStore = Header as any

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
  OCCUPIED
} = REGISTER_FAIL_CODE

interface Iprops {
  history: {
    push: (path: string) => void
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
  private input: HTMLInputElement | null
  public render() {
    const {
      connectStatus,
      connectError
    } = this.props.store
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
            {/* FIXME: Dirty uncontrolled components */}
            <pre>Register new account</pre>
            <input ref={(input) => this.input = input}/>
            <button disabled={this.state.isRegistering} onClick={this.handleRegister}>Register</button>
            <pre>{this.state.registerProgress}</pre>
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
  private handleRegister = () => {
    if (!this.input || !this.input.value) {
      return
    }
    this.setState({
      isRegistering: true
    })
    const {
      register
    } = this.props.store
    register(this.input.value, {
      transactionWillCreate: this.transactionWillCreate,
      transactionDidCreate: this.transactionDidCreate,
      registerRecordDidSave: this.registerRecordDidSave,
      accountWillCreate: this.accountWillCreate,
      accountDidCreate: this.accountDidCreate,
      preKeysDidUpload: this.preKeysDidUpload,
      registerDidComplete: this.registerDidComplete,
      registerDidFail: this.registerDidFail
    })
      .catch(this.registerDidFail)
  }
  private transactionWillCreate = () => {
    this.setState({
      registerProgress: `Creating transaction...
(You may need to confirm the transaction.)`
    })
  }
  private transactionDidCreate = (hash: string) => {
    this.setState({
      registerProgress: `Transaction created (hash: ${hash}).
Saving register record...`
    })
  }
  private registerRecordDidSave = (hash: string) => {
    this.setState({
      registerProgress: `Record saved (and you can safely leave this page from now).
Waiting for transaction (hash: ${hash})...`
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
      registerProgress: `Account created.
Uploading pre-keys...
(You may need to confirm the transaction.)`
    })
  }
  private preKeysDidUpload = () => {
    this.setState({
      registerProgress: 'Pre-keys uploaded.',
      isRegistering: false
    })
  }
  private registerDidComplete = () => {
    this.setState({
      registerProgress: 'Register completed. Redirect to homepage in 5 sec',
      isRegistering: false
    })
    setTimeout(() => {
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
          default:
            return 'other'
        }
      })(),
      isRegistering: false
    })
  }
}

export default withRouter(Register as any)
