import * as React from 'react'

import * as styles from './index.css'

import {
  Icon,
} from 'antd'
import Message from '../Message'

import {
  Lambda,
} from 'mobx'
import {
  observer,
} from 'mobx-react'
import {
  SessionStore,
} from '../../../stores/SessionStore'

import {
  throttle as TypeThrottle,
  debounce as TypeDebounce,
} from 'lodash'
const lodashThrottle: typeof TypeThrottle = require('lodash.throttle')
const lodashDebounce: typeof TypeDebounce = require('lodash.debounce')

@observer
class Messages extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    shouldScroll: true,
  }

  private domRef!: HTMLDivElement
  private disposeNewMessageListener!: Lambda

  public componentDidMount() {
    this.sessionStoreDidLoad(this.props.sessionStore)
    this.props.getScrollToBottom(this.scrollToBottom)
    window.addEventListener('resize', this.handleScrollThrottled)
  }

  public componentWillUnmount() {
    this.sessionStoreWillunload(this.props.sessionStore)
    window.removeEventListener('resize', this.handleScrollThrottled)
  }

  public componentWillUpdate({sessionStore: nextSessionStore}: IProps) {
    const currentSessionStore = this.props.sessionStore
    if (nextSessionStore !== currentSessionStore) {
      this.sessionStoreWillunload(currentSessionStore)
    }
  }

  public componentDidUpdate({sessionStore: prevSessionStore}: IProps) {
    const currentSessionStore = this.props.sessionStore
    if (prevSessionStore !== currentSessionStore) {
      this.sessionStoreDidLoad(currentSessionStore)
    }
  }

  public render() {
    const {
      newUnreadCount,
    } = this.props.sessionStore
    return (
      <div
        className={styles.messages}
        ref={this.storeDOMRef}
        onScroll={this.state.shouldScroll ? this.handleScrollThrottled : this.handleScrollDebounced}
      >
        {
          this.props.sessionStore.messages.map((message) => (
            <Message
              key={message.messageId}
              message={message}
              contact={this.props.sessionStore.session.contact}
            />
          ))
        }
        {
          newUnreadCount > 0
            ? (
              <button
                onClick={this.scrollToBottom}
                className={styles.newUnreadCount}
              >
                <Icon type="down" />
                {` ${
                  newUnreadCount > 99 ? `${newUnreadCount}+` : newUnreadCount
                }`} new message{`${newUnreadCount > 1 ? 's' : ''}`}
              </button>
            )
            : null
        }
      </div>
    )
  }

  private scrollToBottom = () => {
    scroll(this.domRef, getMaxScrollTop(this.domRef))

    if (!this.state.shouldScroll) {
      // force scroll
      this.props.sessionStore.setShouldAddUnread(false)
      this.props.sessionStore.clearNewUnreadCount()
      this.setState({
        shouldScroll: true,
      })
    }
  }

  private storeDOMRef = (self: HTMLDivElement) => {
    this.domRef = self
  }

  private handleReceiveNewMessage = () => {
    if (this.state.shouldScroll) {
      this.scrollToBottom()
    }
  }

  private handleScroll = () => {
    const { domRef } = this

    const shouldScroll = Math.ceil(domRef.scrollTop) >= getMaxScrollTop(domRef) - THRESHOLD
    if (shouldScroll !== this.state.shouldScroll) {
      this.props.sessionStore.setShouldAddUnread(!shouldScroll)
      this.setState({
        shouldScroll,
      })
      if (shouldScroll && this.props.sessionStore.newUnreadCount > 0) {
        this.props.sessionStore.clearNewUnreadCount()
      }
    }
  }

  // tslint:disable-next-line
  private handleScrollThrottled = lodashThrottle(
    this.handleScroll,
    300,
  )

  // tslint:disable-next-line
  private handleScrollDebounced = lodashDebounce(
    this.handleScroll,
    300,
  )

  private sessionStoreDidLoad = (store: SessionStore) => {
    this.disposeNewMessageListener = store.listenForNewMessage(this.handleReceiveNewMessage)
    if (store.newUnreadCount > 0) {
      store.clearNewUnreadCount()
    }
    store.setShouldAddUnread(false)
    this.scrollToBottom()
  }

  private sessionStoreWillunload = (store: SessionStore) => {
    this.disposeNewMessageListener()
    store.setShouldAddUnread(true)
  }
}

function getMaxScrollTop(domElement: HTMLElement) {
  return domElement.scrollHeight - domElement.clientHeight
}

function scroll(domElement: HTMLElement, offset: number) {
  domElement.scrollTop = offset
}

const THRESHOLD = 50

interface IProps {
  sessionStore: SessionStore
  getScrollToBottom: (scrollToBottom: () => void) => void
}

interface IState {
  shouldScroll: boolean
}

export default Messages
