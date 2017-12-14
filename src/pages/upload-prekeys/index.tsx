import * as React from 'react'

import { withRouter } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
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
  }
}

interface Istate {

}

@inject('store') @observer
class UploadPreKeys extends React.Component<Iprops, Istate> {
  public preKeysDidUpload = () => {
    this.props.history.replace("/")
  }

  public handleUploadPrekeys = async () => {
    const {
      store: {
        currentUser,
      } 
    } = this.props
    if (currentUser === undefined) {
      alert("current user is undefined!")
      return
    }

    await this.props.store.uploadPreKeys(currentUser, 1, 200, {
      preKeysDidUpload: this.preKeysDidUpload,
    }).catch(() => {
      console.log("upload pre keys error")
    })
  }

  render() {
    const {
      store: {
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
          <div style={{
            textAlign: 'center'
          }}>
            <button onClick={this.handleUploadPrekeys}>Upload Prekeys</button>
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
}

export default withRouter(UploadPreKeys as any)