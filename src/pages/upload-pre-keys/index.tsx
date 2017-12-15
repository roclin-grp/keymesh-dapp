import * as React from 'react'

import { withRouter, Redirect } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS, USER_STATUS,
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

interface Iprops {
  store: Store
  history: {
    replace: (path: string) => void,
    push: (path: string) => void,
  }
}

interface Istate {
  progress: string
  isUploading: boolean
}

@inject('store') @observer
class UploadPreKeys extends React.Component<Iprops, Istate> {
  public readonly state = {
    progress: '',
    isUploading: false
  }
  private unmounted = false
  public componentDidMount() {
    const {
      connectStatus,
      currentUser,
      listenForConnectStatusChange
    } = this.props.store
    if (
      connectStatus === SUCCESS
      && currentUser
      && (currentUser.uploadPreKeysTransactionHash || currentUser.status === USER_STATUS.IDENTITY_UPLOADED)
    ) {
      this.handleUploadPrekeys()
    }
    listenForConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    const {
      removeConnectStatusListener
    } = this.props.store
    this.unmounted = true
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      store: {
        currentUser,
        connectStatus,
        connectError,
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
          {currentUser
            ? <div style={{
              textAlign: 'center'
            }}>
              <button disabled={this.state.isUploading} onClick={this.handleUploadPrekeys}>Upload Prekeys</button>
              <pre>{this.state.progress}</pre>
            </div>
            : <Redirect to="/" />}
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
  private handleUploadPrekeys = () => {
    const {
      store: {
        currentUser,
        uploadPreKeys
      }
    } = this.props
    if (currentUser === undefined) {
      return
    }

    this.setState({
      isUploading: true
    })

    uploadPreKeys(currentUser, 1, 200, {
      transactionWillCreate: this.transactionWillCreate,
      transactionDidCreate: this.transactionDidCreate,
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail
    }).catch(this.preKeysUploadDidFail)
  }

  private transactionWillCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      progress: `Uploading pre-keys...
(You may need to confirm the transaction.)`
    })
  }

  private transactionDidCreate = (hash: string) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      progress: `Uploading pre-keys...
(Transaction hash: ${hash})
`
    })
  }

  private preKeysDidUpload = () => {
    if (this.unmounted) {
      return
    }
    this.props.history.push('/')
  }

  private preKeysUploadDidFail = (err: Error) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      progress: `Error: ${err.message}`,
      isUploading: false
    })
  }

  private connectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, next: TRUSTBASE_CONNECT_STATUS) => {
    const {
      currentUser
    } = this.props.store
    if (this.unmounted) {
      return
    }
    if (
      prev !== SUCCESS
      && next === SUCCESS
      && currentUser
      && (currentUser.uploadPreKeysTransactionHash || currentUser.status === USER_STATUS.IDENTITY_UPLOADED)
      && !this.state.isUploading
    ) {
      this.handleUploadPrekeys()
    }
  }
}

export default withRouter(UploadPreKeys as any)
