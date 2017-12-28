import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  SENDING_FAIL_CODE
} from '../../constants'

import Header from '../../containers/header'
import Session from '../../containers/session'

import './index.css'

const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

const HeaderWithStore = Header as any
const SessionWithStore = Session as any

interface Iprops {
  store: Store
}

interface Istate {
  isSending: boolean
  sendingProgress: string
  showCompose: boolean
}

@inject('store') @observer
class Home extends React.Component<Iprops, Istate> {
  public readonly state = {
    isSending: false,
    sendingProgress: '',
    showCompose: false
  }
  private unmounted = false
  private toInput: HTMLInputElement | null
  private subjectInput: HTMLInputElement | null
  private messageInput: HTMLTextAreaElement | null
  public componentDidMount(isFirstMount: boolean = true) {
    const {
      connectStatus,
      currentUser,
      loadSessions,
      isFetchingMessage,
      startFetchMessages,
      listenForConnectStatusChange
    } = this.props.store
    if (currentUser) {
      loadSessions()
    }
    if (connectStatus === SUCCESS && currentUser && !isFetchingMessage) {
      startFetchMessages()
    }
    if (isFirstMount) {
      listenForConnectStatusChange(this.connectStatusListener)
    }
  }
  public componentWillUnmount() {
    const {
      stopFetchMessages,
      removeConnectStatusListener
    } = this.props.store
    this.unmounted = true
    stopFetchMessages()
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      connectStatus,
      currentUser,
      currentUserSessions,
      newMessageCount
    } = this.props.store
    const {
      showCompose
    } = this.state
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
      case SUCCESS:
      case OFFLINE:
      case NO_ACCOUNT:
      case CONTRACT_ADDRESS_ERROR:
      case ERROR:
        return <div>
          <HeaderWithStore shouldRefreshSessions={true} />
          <div
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {
              connectStatus === SUCCESS
              && currentUser
                ? <div>
                  <button
                    style={{
                      margin: '0 auto 20px',
                      width: 200,
                      display: 'block',
                      padding: '10px 20px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      background: showCompose ? 'red' : 'aquamarine',
                      outline: 'none',
                      border: 0,
                      color: 'white',
                    }}
                    onClick={this.toggleCompose}
                  >
                    {showCompose ? 'Cancel' : 'Compose'}
                  </button>
                  {showCompose
                    ? <div
                        style={{
                          textAlign: 'center'
                        }}
                    >
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
                            disabled={this.state.isSending}
                            onClick={this.handleSend}
                          >
                            Send
                          </button>
                        </div>
                      <pre>{this.state.sendingProgress}</pre>
                    </div>
                    : null}
                </div>
                : null
            }
            {
              connectStatus === SUCCESS
              && currentUser
              && newMessageCount > 0
              ? <div
                className="new-messages-prompt"
                onClick={this.refreshSessions}
              >
                Received {newMessageCount} new message(s)
              </div>
              : null
            }
            {
              currentUser
                ? <ul className="session-list">{
                    currentUserSessions
                      .map((session) => <SessionWithStore
                        key={session.sessionTag}
                        session={session}
                      />)
                  }</ul>
                : 'No account'
            }
          </div>
        </div>
      default:
        return null
    }
  }
  private refreshSessions = () => {
    const {
      loadSessions
    } = this.props.store
    if (this.unmounted) {
      return
    }
    loadSessions()
  }

  private connectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => {
    const {
      stopFetchMessages
    } = this.props.store
    if (this.unmounted) {
      return
    }
    if (prev !== SUCCESS) {
      this.componentDidMount(false)
    } else if (cur !== SUCCESS) {
      stopFetchMessages()
    }
  }

  private toggleCompose = () => {
    this.setState({
      showCompose: !this.state.showCompose,
      sendingProgress: ''
    })
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
        transactionDidCreate: this.txCreated,
        sendingDidFail: this.sendingDidFail
      }
    ).catch(this.sendingDidFail)
  }

  private transactionWillCreate = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      sendingProgress: `Sending...
(You may need to confirm the transaction.)`
    })
  }
  private emptyForm = () => {
    if (this.toInput) {
      this.toInput.value = ''
    }
    if (this.subjectInput) {
      this.subjectInput.value = ''
    }
    if (this.messageInput) {
      this.messageInput.value = ''
    }
  }

  private txCreated = () => {
    this.emptyForm()
    this.setState(
      {
        sendingProgress: 'Sent.',
        isSending: false
      }, 
      () => {
        window.setTimeout(
          () => {
            if (!this.state.isSending) {
              this.setState({
                sendingProgress: ''
              })
            }
          },
          3000
        )
      }
    )
  }

  private sendingDidFail =  (err: Error | null, code = SENDING_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      sendingProgress: (() => {
        switch (code) {
          case SENDING_FAIL_CODE.UNKNOWN:
            return `${(err as Error).message} \n ${(err as Error).stack}`
          case SENDING_FAIL_CODE.INVALID_MESSAGE:
            return `Invalid message.`
          default:
            return 'other'
        }
      })(),
      isSending: false
    })
  }
}

export default Home
