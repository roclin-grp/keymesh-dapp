import * as React from 'react'

import { withRouter, Redirect, RouteComponentProps } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  USER_STATUS
} from '../../constants'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
import RegisterRecords from '../../containers/register-records'

import './index.css'

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

interface Iparams {
  networkId: string
}

type Iprops = RouteComponentProps<Iparams>

interface IinjectedProps extends Iprops {
  store: Store
}

interface Istate {
  registerProgress: string
}

@inject('store') @observer
class CheckRegister extends React.Component<Iprops, Istate> {
  public readonly state = Object.freeze({
    registerProgress: ''
  })

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private unmounted = false
  public componentDidMount() {
    const {
      store: {
        connectStatus,
        currentEthereumNetwork,
        currentUser,
        checkRegister,
        listenForConnectStatusChange
      },
      match: {
        params: {
          networkId
        }
      },
      history
    } = this.injectedProps
    const {
    } = this.injectedProps.store
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
    } = this.injectedProps.store
    this.unmounted = true
    clearRegisteringUser()
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      match: {
        params: {
          networkId
        }
      }
    } = this.injectedProps
    const {
      currentUser,
      currentEthereumNetwork,
      connectStatus,
      connectError
    } = this.injectedProps.store

    switch (connectStatus) {
      case PENDING:
        return <CommonHeaderPage />
      case OFFLINE:
        return (
          <CommonHeaderPage>
            <pre>You are offline!</pre>
          </CommonHeaderPage>
        )
      case NO_ACCOUNT:
        return (
          <CommonHeaderPage>
            <pre>Found no Ethereum account. (You may need to unlock MetaMask.)</pre>
          </CommonHeaderPage>
        )
      case SUCCESS:
        return (
          <CommonHeaderPage>
            {
              networkId
              ? <RegisterRecords />
              : currentUser && currentUser.status === USER_STATUS.PENDING
                ? <pre>{this.state.registerProgress}</pre>
                : currentUser && currentUser.status === USER_STATUS.IDENTITY_UPLOADED
                  ? <Redirect to="/upload-pre-keys" />
                  : <Redirect to={`/check-register/${currentEthereumNetwork}`} />
            }
          </CommonHeaderPage>
        )
      case CONTRACT_ADDRESS_ERROR:
      case ERROR:
        return (
          <CommonHeaderPage>
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
              <pre>{(connectError as Error).stack}</pre>
            </div>
          </CommonHeaderPage>
        )
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
    } = this.injectedProps
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

export default withRouter(CheckRegister)
