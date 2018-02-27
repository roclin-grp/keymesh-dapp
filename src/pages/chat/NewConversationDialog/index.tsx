import * as React from 'react'

// component
import {
  Form,
  Input,
  Icon,
  message,
} from 'antd'
const FormItem = Form.Item
import {
  FormComponentProps,
} from 'antd/lib/form'
import DialogTextArea from '../DialogTextArea'

// style
import * as styles from './index.css'

// state management
import {
  ChatMessagesStore,
} from '../../../stores/ChatMessagesStore'

// helper
import {
  storeLogger,
} from '../../../utils/loggers'
import { isAddress } from '../../../utils/cryptos'
import { MESSAGE_TYPE, createMessage } from '../../../databases/MessagesDB'
import { createSession } from '../../../databases/SessionsDB'
import { IUser } from '../../../stores/UserStore'

// TODO merge this component to Dialog
class NewConversationDialog extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = Object.freeze({
    isSending: false,
    sendButtonContent: 'Send',
  })

  private unmounted = false

  private userAddressInput: Input | null = null

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const { getFieldDecorator, getFieldValue } = this.props.form
    const userAddress = getFieldValue('userAddress')
    return (
      <div className={styles.dialog}>
        <Form>
          <FormItem>
            {getFieldDecorator('userAddress', {
              rules: [
                { required: true, message: 'Please enter receiver address!' },
                {
                  validator: this.validUserAddress,
                },
              ],
            })(
              <Input
                autoFocus={true}
                disabled={this.state.isSending}
                spellCheck={false}
                placeholder="Receiver Address"
                prefix={<Icon type="user" className={styles.prefixIcon} />}
                suffix={
                  userAddress != null
                  && userAddress !== ''
                  && !this.state.isSending
                    // FIXME: wrap icon to a clickable element
                    ? <Icon type="close-circle" onClick={this.resetUserAddress} />
                    : null
                }
                ref={(node) => this.userAddressInput = node}
              />,
            )}
          </FormItem>
        </Form>
        <DialogTextArea
          className={styles.dialogInputContainer}
          isSending={this.state.isSending}
          buttonContent={this.state.sendButtonContent}
          onSubmit={this.handleSubmit}
        />
      </div>
    )
  }

  private handleSubmit = (plainText: string) => {
    if (this.state.isSending) {
      return
    }

    this.props.form.validateFields(async (err: Error, {
      userAddress,
    }: IFormData) => {
      if (err) {
        this.resetUserAddress()
        return
      }

      this.setState({
        isSending: true,
        sendButtonContent: 'Processing...',
      })

      const { chatMessagesStore, user } = this.props
      try {
        const receiver = await chatMessagesStore.getMessageReceiver(userAddress)

        const sessionData = {
          contact: userAddress,
        }
        const newSession = createSession(user, sessionData)

        const messageData = {
          payload: plainText,
          timestamp: Date.now(),
          messageType: MESSAGE_TYPE.HELLO,
        }
        const newMessage = createMessage(newSession, messageData)

        this.handleStartSending()

        await this.props.chatMessagesStore.sendMessage(
          receiver,
          newSession,
          newMessage,
        )
        this.handleMessageDidSend()
      } catch (err) {
        this.handSendFail(err)
      }
    })
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
      this.setState({
        isSending: false,
        sendButtonContent: 'Send',
      })
    }
  }

  private handSendFail = (err: Error) => {
    if (this.unmounted) {
      return
    }

    this.setState({
      isSending: false,
      sendButtonContent: 'Send',
    })

    if (err.message.includes('User denied transaction signature')) {
      message.error('Fail to send, you reject the transaction.')
      return
    }

    storeLogger.error('Unexpected register error:', err)
    message.error('Fail to send, please retry.')
  }

  private validUserAddress = (
    _: object,
    userAddress: string | undefined,
    done: (isValid?: boolean) => void,
  ) => {
    if (userAddress != null) {
      if (userAddress === '') {
        return done()
      }
      if (userAddress === this.props.user.userAddress) {
        return (done as any)(`Can't send message to yourself!`)
      }
      if (!isAddress(userAddress)) {
        return (done as any)('Invalid address!')
      }
    }
    done()
  }

  private resetUserAddress = () => {
    const {userAddressInput} = this
    if (userAddressInput !== null) {
      userAddressInput.focus()
      this.props.form.resetFields([
        'userAddress',
      ])
    }
  }
}

interface IProps extends FormComponentProps {
  user: IUser
  chatMessagesStore: ChatMessagesStore
}

interface IState {
  isSending: boolean
  sendButtonContent: React.ReactNode
}

interface IFormData {
  userAddress: string
}

export default Form.create()(NewConversationDialog)
