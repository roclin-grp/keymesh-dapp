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
import {
  SENDING_FAIL_CODE,
} from '../../../stores/ChatMessagesStore/typings'
import {
  MESSAGE_TYPE,
} from '../../../stores/ChatMessageStore'

// helper
import {
  storeLogger,
} from '../../../utils/loggers'

// TODO merge this component to Dialog
class NewConversationDialog extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = Object.freeze({
    isSending: false,
    sendButtonContent: 'Send',
  })

  private unmounted = false

  private userAddressInput: Input | null

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
                  typeof userAddress !== 'undefined'
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
    if (!this.state.isSending) {
      this.props.form.validateFields((err: Error, {
        userAddress,
      }: IFormData) => {
        if (!err) {
          this.setState({
            isSending: true,
            sendButtonContent: 'Checking...',
          })
          this.props.chatMessagesStore.sendMessage(
            userAddress,
            MESSAGE_TYPE.HELLO,
            {
              transactionWillCreate: this.transactionWillCreate,
              transactionDidCreate: this.transactionDidCreate,
              messageDidCreate: this.messageDidCreate,
              sendingDidFail: this.sendingDidFail,
              plainText,
            },
          ).catch(this.sendingDidFail)
        } else {
          this.resetUserAddress()
        }
      })
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
      this.setState({
        isSending: false,
        sendButtonContent: 'Send',
      })
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
          case SENDING_FAIL_CODE.INVALID_USER_ADDRESS:
            return `Fail to send, please enter receiver address!`
          case SENDING_FAIL_CODE.SEND_TO_YOURSELF:
            return `Fail to send, can't send message to yourself!`
          case SENDING_FAIL_CODE.INVALID_MESSAGE:
            return 'Fail to send, receiver address is invalid!'
          case SENDING_FAIL_CODE.INVALID_MESSAGE_TYPE:
          default:
            if ((err as Error).message.includes('User denied transaction signature')) {
              return 'Fail to send, you reject the transaction.'
            }
            storeLogger.error('Unexpected register error:', err as Error)
            return 'Fail to send, please retry.'
        }
      })())
    }
  }

  private validUserAddress = (
    _: Object,
    userAddress: string | undefined,
    done: (isValid?: boolean) => void,
  ) => {
    if (
      typeof userAddress !== 'undefined'
    ) {
      if (userAddress === '') {
        return done()
      }
      if (userAddress === this.props.selfAddress) {
        return (done as any)(`Can't send message to yourself!`)
      }
      if (!userAddress.startsWith('0x')) {
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
  selfAddress: string
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
