import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import formatSessionTimestamp from '../../formatSessionTimestamp'
import Message from '../../components/message'

import {
  SENDING_FAIL_CODE,
  TRUSTBASE_CONNECT_STATUS
} from '../../constants'

import {
  Isession
} from '../../../typings/interface.d'

import './index.css'

const noop = () => {/**/}

interface Iprops {
  sessionTag: string
  index: number
  subject: string
  contact: string
  unreadCount: number
  lastUpdate: number
  // summary: string
}

interface IpropsWithStore extends Iprops {
  store: Store
}

interface Istate {
  sendingProgress: string
  isLoading: boolean
  isSending: boolean
}

@inject('store') @observer
class Session extends React.Component<IpropsWithStore, Istate> {
  public readonly state = {
    isLoading: false,
    isSending: false,
    sendingProgress: ''
  }
  private input: HTMLInputElement | null
  public render() {
    const {
      sessionTag,
      index,
      unreadCount,
      contact,
      subject,
      lastUpdate,
      store: {
        currentSessionIndex,
        currentSessionMessages,
        connectStatus
      }
    } = this.props
    const {
      isLoading
    } = this.state
    if (currentSessionIndex === index) {
      return <li className="session-expanded">
        <div className="subject">
          {subject}
        </div>
        {
          currentSessionMessages.length > 0
          ? <ul style={{padding: 0}}>{
            currentSessionMessages
              .map((message) => <Message
                key={`${sessionTag}${message.timestamp}`}
                contact={contact}
                {...message}
              />)
          }</ul>
          : null
        }
        {
          connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS
            ? <div className="send-new-msg">
                <input className="new-msg-input" ref={(input) => this.input = input}/>
                <button
                  disabled={this.state.isSending}
                  onClick={this.handleSend}
                >
                  Send
                </button>
                <pre>{this.state.sendingProgress}</pre>
              </div>
            : null
        }
      </li>
    }
    return <li
      className="session--unexpand"
      onClick={isLoading ? noop : this.handleClick}>
      {unreadCount > 0
        ?<span className="unread-msg-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        : null
      }
      <span className="contact">{contact}</span>
      {subject}
      <span className="last-update-time">{formatSessionTimestamp(lastUpdate)}</span>
    </li>
  }
  private handleClick = async (e: React.MouseEvent<HTMLLIElement>) => {
    e.preventDefault()
    const {
      index,
      store: {
        selectSession
      }
    } = this.props
    this.setState({
      isLoading: true
    })
    await selectSession(index)
    this.setState({
      isLoading: false
    })
  }
  private handleSend = async () => {
    const {
      connectStatus,
      currentSession,
      currentUser
    } = this.props.store
    if (
      (!this.input || !this.input.value)
      || !currentSession
      || (currentSession as Isession).isClosed
      || !currentUser
      || connectStatus !== TRUSTBASE_CONNECT_STATUS.SUCCESS
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
      currentSession.contact,
      currentSession.subject,
      this.input.value,
      {
        transactionWillCreate: this.transactionWillCreate,
        sendingDidComplete: this.sendingDidComplete,
        sendingDidFail: this.sendingDidFail
      },
      currentSession.sessionTag
    ).catch(this.sendingDidFail)
  }

  private transactionWillCreate = () => {
    this.setState({
      sendingProgress: `Sending...
(You may need to confirm the transaction.)`
    })
  }
  private sendingDidComplete = () => {
    if (this.input) {
      this.input.value = ''
    }
    this.setState({
      sendingProgress: 'Sent.',
      isSending: false
    })
  }
  private sendingDidFail =  (err: Error | null, code = SENDING_FAIL_CODE.UNKNOWN) => {
    this.setState({
      sendingProgress: (() => {
        switch (code) {
          case SENDING_FAIL_CODE.UNKNOWN:
            return `${(err as Error).message} \n ${(err as Error).stack}`
          case SENDING_FAIL_CODE.INVALID_USERNAME:
            return `Invalid username.`
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

export default Session
