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
  SENDING_FAIL_CODE,
} from '../../../stores/ChatMessagesStore/typings'
import {
  MESSAGE_TYPE,
} from '../../../stores/ChatMessageStore'
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
            {session.subject || session.contact.userAddress}
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

  private handleSubmit = (plainText: string) => {
    if (!this.state.isSending) {
      this.setState({
        isSending: true,
        sendButtonContent: 'Checking...',
      })
      this.props.chatMessagesStore.sendMessage(
        this.props.sessionStore.session.contact.userAddress,
        MESSAGE_TYPE.NORMAL,
        {
          transactionWillCreate: this.transactionWillCreate,
          transactionDidCreate: this.transactionDidCreate,
          messageDidCreate: this.messageDidCreate,
          sendingDidFail: this.sendingDidFail,
          plainText,
          sessionTag: this.props.sessionStore.session.sessionTag,
        }
      ).catch(this.sendingDidFail)
    }
  }

  private transactionWillCreate = () => {
    if (!this.unmounted) {
      this.setState({
        sendButtonContent: 'Please confirm the transaction...',
      })
    }
  }

  private transactionDidCreate = () => {
    if (!this.unmounted) {
      this.setState({
        sendButtonContent: 'Sending...',
      })
    }
  }

  private messageDidCreate = () => {
    if (!this.unmounted) {
      this.messagesScrollToBottom()
      this.setState({
        isSending: false,
        sendButtonContent: 'Send',
      })
      this.props.sessionStore.setDraft('')
    }
  }

  private sendingDidFail = (err: Error | null, code = SENDING_FAIL_CODE.UNKNOWN) => {
    if (!this.unmounted) {
      this.setState({
        isSending: false,
        sendButtonContent: 'Send',
      })

      message.error((() => {
        switch (code) {
          case SENDING_FAIL_CODE.INVALID_MESSAGE:
            return 'Fail to send message, please enter message!'
          case SENDING_FAIL_CODE.SEND_TO_YOURSELF:
          case SENDING_FAIL_CODE.INVALID_USER_ADDRESS:
          case SENDING_FAIL_CODE.INVALID_MESSAGE_TYPE:
          default:
            if ((err as Error).message.includes('User denied transaction signature')) {
              return 'Fail to send message, you reject the transaction.'
            }
            storeLogger.error('Unexpected message sending error:', err as Error)
            return 'Fail to send message, please retry.'
        }
      })())
    }
  }

  private showDeleteSessionConfirm = () => {
    confirm({
      title: 'Are you sure delete this conversation?',
      content: 'You will NOT able to receive his/her messages after deleted!',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'No',
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
