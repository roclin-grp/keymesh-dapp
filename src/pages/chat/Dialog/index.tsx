import * as React from 'react'

// component
import {
  Button,
  Modal,
  message,
} from 'antd'
const {confirm} = Modal
import Messages from '../Messages'
import DialogTextArea from '../DialogTextArea'

// style
import * as styles from './index.css'

// state management
import {
  observer,
} from 'mobx-react'
import {
  ChatMessagesStore,
} from '../../../stores/ChatMessagesStore'
import {
  SessionStore,
} from '../../../stores/SessionStore'

import {
  noop,
} from '../../../utils'

// helper
import {
  storeLogger,
} from '../../../utils/loggers'
import { MESSAGE_TYPE, createMessage } from '../../../databases/MessagesDB'

@observer
class Dialog extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    isSending: false,
    sendButtonContent: 'Send',
  }

  private messagesScrollToBottom = noop
  private unmounted = false

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {
      session,
    } = this.props.sessionStore

    return (
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {session.data.subject || session.data.contact}
          </h3>
          <Button
            onClick={this.showDeleteSessionConfirm}
            shape="circle"
            icon="delete"
            size="small"
            type="danger"
            ghost={true}
          />
        </div>
        <Messages sessionStore={this.props.sessionStore} getScrollToBottom={this.getMessagesScrollToBottom}/>
        <DialogTextArea
          sessionStore={this.props.sessionStore}
          isSending={this.state.isSending}
          buttonContent={this.state.sendButtonContent}
          onSubmit={this.handleSubmit}
        />
      </div>
    )
  }

  private handleSubmit = async (plainText: string) => {
    if (this.state.isSending) {
      return
    }

    this.setState({
      isSending: true,
      sendButtonContent: 'Processing...',
    })

    const { chatMessagesStore, sessionStore } = this.props
    const { session } = sessionStore
    try {
      const receiver = await chatMessagesStore.getMessageReceiver(session.data.contact)
      const messageData = {
        payload: plainText,
        timestamp: Date.now(),
        messageType: MESSAGE_TYPE.NORMAL,
      }
      const newMessage = createMessage(session, messageData)

      this.handleStartSending()

      await this.props.chatMessagesStore.sendMessage(
        receiver,
        session,
        newMessage,
      )
      this.handleMessageDidSend()
    } catch (err) {
      this.handleSendFail(err)
    }
  }

  private handleStartSending = () => {
    if (!this.unmounted) {
      this.setState({
        sendButtonContent: 'Please confirm the transaction...',
      })
    }
  }

  private handleMessageDidSend = () => {
    if (!this.unmounted) {
      this.messagesScrollToBottom()
      this.setState({
        isSending: false,
        sendButtonContent: 'Send',
      })
      this.props.sessionStore.setDraft('')
    }
  }

  private handleSendFail = (err: Error) => {
    if (this.unmounted) {
      return
    }

    this.setState({
      isSending: false,
      sendButtonContent: 'Send',
    })

    if (err.message.includes('User denied transaction signature')) {
      message.error('Fail to send message, you reject the transaction.')
      return
    }

    storeLogger.error('Unexpected message sending error:', err)
    message.error('Fail to send message, please retry.')
  }

  private showDeleteSessionConfirm = () => {
    confirm({
      title: 'Are you sure delete this conversation?',
      content: 'You will NOT able to receive his/her messages after deleted!',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: this.handleDeleteSession,
    })
  }

  private handleDeleteSession = () => {
    // TODO
  }

  private getMessagesScrollToBottom = (messagesScrollToBottom: () => void) => {
    this.messagesScrollToBottom = messagesScrollToBottom
  }
}

interface IProps {
  chatMessagesStore: ChatMessagesStore
  sessionStore: SessionStore
}

interface IState {
  isSending: boolean
  sendButtonContent: React.ReactNode
}

export default Dialog
