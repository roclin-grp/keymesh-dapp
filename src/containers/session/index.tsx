import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import formatSessionTimestamp from '../../formatSessionTimestamp'
import Message from '../../components/message'
import Avatar from '../../components/avatar'
import {getUsernameHash as web3UtilsSha3} from 'trustbase'

import {
  SENDING_FAIL_CODE,
  TRUSTBASE_CONNECT_STATUS,
  SUBJECT_LENGTH
} from '../../constants'

import {
  Isession
} from '../../../typings/interface.d'

import './index.css'

const noop = () => {/**/}

interface Iprops {
  session: Isession
  store: Store
}

interface Istate {
  sendingProgress: string
  isLoading: boolean
  isSending: boolean
}

@inject('store') @observer
class Session extends React.Component<Iprops, Istate> {
  public readonly state = {
    isLoading: false,
    isSending: false,
    sendingProgress: ''
  }
  private input: HTMLInputElement | null
  public render() {
    const {
      session: {
        isClosed,
        sessionTag,
        unreadCount,
        contact,
        subject,
        summary,
        lastUpdate,
      },
      store: {
        currentSession,
        currentSessionMessages,
        connectStatus
      }
    } = this.props
    const {
      isLoading
    } = this.state
    const showSubject = subject === ''
      ? '(No subject)'
      : `${subject.slice(0, SUBJECT_LENGTH)}${subject.length > SUBJECT_LENGTH ? '...' : ''}`
    if (currentSession && currentSession.sessionTag === sessionTag) {
      return <li className="session-expanded">
        <div className="session-header">
          <i
            title="fold"
            className="hide-button fa fa-chevron-up"
            aria-hidden="true"
            onClick={this.handleHide}
          />
          <span
            title={subject === '' ? '(No subject)' : subject}
            className={`subject${subject === '' ? ' subject--empty' : ''}`}>
            {showSubject}
          </span>
          <i
            className="options fa fa-ellipsis-v"
            aria-hidden="true">
          </i>
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
    // todo add timestamp, and block hash
    const avatarHash = web3UtilsSha3(`${contact.usernameHash}${contact.blockHash}`)
    return <li
      className="session--unexpand"
      onClick={isLoading ? noop : this.handleSelect}>
      <Avatar hash={avatarHash} size={35}/>
      <span
        title={contact.username}
        className="contact">
        {contact.username}
      </span>
      {unreadCount > 0
        ? <span className="unread-msg-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        : null
      }
      <span
        title={subject === '' ? '(No subject)' : subject}
        className={`subject${subject === '' ? ' subject--empty' : ''}`}>
        {showSubject}
      </span>
      <span className={`summary${isClosed ? ' summary--closed' : ''}`}>{summary}</span>
      <span className="last-update-time">{formatSessionTimestamp(lastUpdate)}</span>
    </li>
  }
  private handleSelect = async () => {
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    const {
      session,
      store: {
        selectSession
      }
    } = this.props
    this.setState({
      isLoading: true
    })
    await selectSession(session)
    this.setState({
      isLoading: false
    })
  }

  private handleHide = (e: React.MouseEvent<HTMLBaseElement>) => {
    e.preventDefault()
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    this.props.store.unselectSession()
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
      currentSession.contact.username,
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
    }, () => {
      window.setTimeout(() => {
        if (!this.state.isSending) {
          this.setState({
            sendingProgress: ''
          })
        }
      }, 3000)
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
