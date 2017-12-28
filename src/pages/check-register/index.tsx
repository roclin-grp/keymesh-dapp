import * as React from 'react'

import { withRouter, Redirect } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  USER_STATUS
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
  REGISTERED,
  TIMEOUT
} = REGISTER_FAIL_CODE

interface Iprops {
  store: Store
  history: {
    replace: (path: string) => void
  }
  match: {
    params: {
      networkId?: string
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
  private unmounted = false
  public componentDidMount() {
    const {
      store: {
        connectStatus,
        checkRegister,
        listenForConnectStatusChange,
        currentEthereumNetwork,
        currentUser
      },
      match: {
        params: {
          networkId
        }
      },
      history
    } = this.props
    if (
      typeof currentEthereumNetwork !== 'undefined'
      && typeof networkId !== 'undefined'
      && Number(networkId) !== currentEthereumNetwork
    ) {
      return history.replace(`/check-register/${currentEthereumNetwork}`)
    }
    if (
      connectStatus === SUCCESS
      && typeof networkId === 'undefined'
      && currentUser
      && currentUser.registerRecord
    ) {
      checkRegister(currentUser, {
        checkRegisterWillStart: this.checkRegisterWillStart,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
    listenForConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    const {
      removeConnectStatusListener,
      clearRegisteringUser
    } = this.props.store
    this.unmounted = true
    clearRegisteringUser()
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      store: {
        currentUser,
        currentEthereumNetwork,
        connectStatus,
        connectError
      },
      match: {
        params: {
          networkId
        }
      }
    } = this.props

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
            {
              networkId
              ? <RegisterRecordsWithStore />
              : currentUser && currentUser.status === USER_STATUS.PENDING
                ? <pre>{this.state.registerProgress}</pre>
                : currentUser && currentUser.status === USER_STATUS.IDENTITY_UPLOADED
                  ? <Redirect to="/upload-pre-keys" />
                  : <Redirect to={`/check-register/${currentEthereumNetwork}`} />
            }
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
  private checkRegisterWillStart = (hash: string) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      registerProgress: `Waiting for transaction(hash: ${hash})...`
    })
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
        currentEthereumNetwork,
        currentUser
      },
      match: {
        params: {
          networkId
        }
      },
      history
    } = this.props
    if (this.unmounted) {
      return
    }
    if (
      typeof currentEthereumNetwork !== 'undefined'
      && typeof networkId !== 'undefined'
      && Number(networkId) !== currentEthereumNetwork
    ) {
      return history.replace(`/check-register/${currentEthereumNetwork}`)
    }
    if (
      prev !== SUCCESS
      && cur === SUCCESS
      && typeof networkId === 'undefined'
      && currentUser
      && currentUser.registerRecord
    ) {
      checkRegister(currentUser, {
        checkRegisterWillStart: this.checkRegisterWillStart,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
  }
}

export default withRouter(CheckRegister as any)
