import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  SENDING_FAIL_CODE
} from '../../constants'

import Header from '../../containers/header'

const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

const {
  UNKNOWN = 0,
  INVALID_USERNAME = 401,
  INVALID_MESSAGE = 402
} = SENDING_FAIL_CODE

interface Iprops {
  store: Store
}

interface Istate {
  sendingProgress: string
  isSending: boolean
}

const HeaderWithStore = Header as any

@inject('store') @observer
class Send extends React.Component<Iprops, Istate> {
  public readonly state = {
    sendingProgress: '',
    isSending: false
  }
  private toInput: HTMLInputElement | null
  private subjectInput: HTMLInputElement | null
  private messageInput: HTMLTextAreaElement | null
  public render() {
    const {
      connectStatus,
      connectError,
      currentUser
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
          {currentUser
            ? <div style={{
              textAlign: 'center'
            }}>
              {/* FIXME: Dirty uncontrolled components */}
              <div>
                <label>To:</label><input ref={(input) => this.toInput = input}/>
              </div>
              <div>
                <label>Subject:</label><input ref={(input) => this.subjectInput = input}/>
              </div>
              <div>
                <label>Message:</label><textarea ref={(input) => this.messageInput = input}/>
              </div>
              <div>
                <button
                  disabled={this.state.isSending || Object.keys(this.props.store.currentNetworkUsers).length === 0}
                  onClick={this.handleSend}
                >Send</button>
              </div>
            <pre>{this.state.sendingProgress}</pre>
          </div>
          : <div style={{
            textAlign: 'center'
          }}>No User</div>
          }
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

  private handleSend = async () => {
    if (
      (!this.toInput || !this.toInput.value)
      || (!this.messageInput || !this.messageInput.value)
      || !this.subjectInput
      || !this.props.store.currentUser
    ) {
      return
    }
    this.setState({
      isSending: true
    })
    const {
      send
    } = this.props.store

    send(
      this.toInput.value,
      this.subjectInput.value,
      this.messageInput.value,
      {
        transactionWillCreate: this.transactionWillCreate,
        sendingDidComplete: this.sendingDidComplete,
        sendingDidFail: this.sendingDidFail
      }
    ).catch(this.sendingDidFail)
  }

  private transactionWillCreate = () => {
    this.setState({
      sendingProgress: `Sending...
(You may need to confirm the transaction.)`
    })
  }
  private sendingDidComplete = () => {
    this.setState({
      sendingProgress: 'Sent.',
      isSending: false
    })
  }
  private sendingDidFail =  (err: Error | null, code = UNKNOWN) => {
    this.setState({
      sendingProgress: (() => {
        switch (code) {
          case UNKNOWN:
            return `${(err as Error).message} \n ${(err as Error).stack}`
          case INVALID_USERNAME:
            return `Invalid username.`
          case INVALID_MESSAGE:
            return `Invalid message.`
          default:
            return 'other'
        }
      })(),
      isSending: false
    })
  }
}

export default Send
