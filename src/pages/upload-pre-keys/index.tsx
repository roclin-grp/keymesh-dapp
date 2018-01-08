import * as React from 'react'

import { withRouter, Redirect, RouteComponentProps } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS, USER_STATUS,
} from '../../constants'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

type Iprops = RouteComponentProps<{}>

interface IinjectedProps extends Iprops {
  store: Store
}

interface Istate {
  progress: string
  isUploading: boolean
}

@inject('store') @observer
class UploadPreKeys extends React.Component<Iprops, Istate> {
  public readonly state = Object.freeze({
    progress: '',
    isUploading: false
  })

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private unmounted = false
  public componentDidMount() {
    const {
      connectStatus,
      currentUser,
      listenForConnectStatusChange
    } = this.injectedProps.store
    if (
      connectStatus === SUCCESS
      && currentUser
    ) {
      this.handleUploadPrekeys()
    }
    listenForConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    const {
      removeConnectStatusListener
    } = this.injectedProps.store
    this.unmounted = true
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      currentUser,
      connectStatus,
      connectError,
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
            {currentUser
              ? (
                <div>
                  {
                    currentUser.status === USER_STATUS.IDENTITY_UPLOADED
                    ? <pre>You need to upload pre keys before continue using this account</pre>
                    : null
                  }
                  <button disabled={this.state.isUploading} onClick={this.handleUploadPrekeys}>Upload Prekeys</button>
                  <pre>{this.state.progress}</pre>
                </div>
              )
              : <Redirect to="/" />}
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
  private handleUploadPrekeys = () => {
    const {
      currentUser,
      uploadPreKeys
    } = this.injectedProps.store
    if (currentUser === undefined) {
      return
    }

    this.setState({
      isUploading: true,
      progress: `Uploading pre-keys...`
    })

    uploadPreKeys(currentUser, 1, 200, {
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail
    }).catch(this.preKeysUploadDidFail)
  }

  private preKeysDidUpload = () => {
    if (this.unmounted) {
      return
    }
    this.injectedProps.history.push('/')
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
    } = this.injectedProps.store
    if (this.unmounted) {
      return
    }
    if (
      prev !== SUCCESS
      && next === SUCCESS
      && currentUser
      && !this.state.isUploading
    ) {
      this.handleUploadPrekeys()
    }
  }
}

export default withRouter(UploadPreKeys)
