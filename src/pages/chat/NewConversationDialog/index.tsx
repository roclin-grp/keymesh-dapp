import * as React from 'react'

// component
import {
  Form,
  Input,
  Icon,
  message,
  Button,
} from 'antd'
const FormItem = Form.Item
import {
  FormComponentProps,
} from 'antd/lib/form'

// style
import * as styles from './index.css'

// state management
import { IUser } from '../../../stores/UserStore'
import { SessionsStore } from '../../../stores/SessionsStore'

// helper
import { isAddress } from '../../../utils/cryptos'
import { storeLogger } from '../../../utils/loggers'

// TODO merge this component to Dialog
class NewConversationDialog extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    isProcessing: false,
  }

  private unmounted = false
  private userAddressInput: Input | null = null

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const { getFieldDecorator, getFieldError, getFieldValue } = this.props.form
    const hasAddress = getFieldValue('userAddress') != null
    const isInvalidAddress = !hasAddress || getFieldError('userAddress') != null
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
                disabled={this.state.isProcessing}
                spellCheck={false}
                placeholder="Receiver Address"
                prefix={<Icon type="user" className={styles.prefixIcon} />}
                suffix={this.renderResetUserAddress()}
                ref={(node) => this.userAddressInput = node}
              />,
            )}
          </FormItem>
        </Form>
        <Button
          className={styles.createNewSessionButton}
          type="primary"
          size="large"
          disabled={this.state.isProcessing || isInvalidAddress}
          onClick={this.handleCreate}
        >
          {
            this.state.isProcessing
              ? 'Checking...'
              : 'Create new conversation'
          }
        </Button>
      </div>
    )
  }

  private renderResetUserAddress() {
    const userAddress = this.props.form.getFieldValue('userAddress')
    if (userAddress == null || userAddress === '' || this.state.isProcessing) {
      return null
    }

    return (
      <a onClick={this.resetUserAddress} className={styles.resetUserAddress}>
        <Icon type="close-circle" onClick={this.resetUserAddress} />
      </a>
    )
  }

  private handleCreate = () => {
    if (this.state.isProcessing) {
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
        isProcessing: true,
      })

      const { sessionsStore } = this.props
      try {
        const session = await sessionsStore.createNewConversation(userAddress)
        sessionsStore.addSession(session)
        await sessionsStore.selectSession(session)
      } catch (err) {
        this.handCreateFail(err)
      }
    })
  }

  private handCreateFail(err: Error) {
    if (this.unmounted) {
      return
    }

    this.setState({
      isProcessing: false,
    })

    // TODO: show error detail
    storeLogger.error(err)
    message.error('Create session fail, please retry')
  }

  private validUserAddress = async (
    _: object,
    userAddress: string | undefined,
    done: (errorMessage?: string) => void,
  ) => {
    // antd's issue
    if (userAddress != null) {
      if (userAddress === '') {
        return done()
      }
      if (userAddress === this.props.user.userAddress) {
        return done(`Can't send message to yourself!`)
      }
      if (!isAddress(userAddress)) {
        return done('Invalid address!')
      }
      try {
        // check receiver's public key and pre-keys package
        await this.props.sessionsStore.validateReceiver(userAddress)
        return done()
      } catch (err) {
        return done('User had not registered with KeyMesh')
      }
    }
    done()
  }

  private resetUserAddress = () => {
    const { userAddressInput } = this
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
  sessionsStore: SessionsStore
}

interface IState {
  isProcessing: boolean
}

interface IFormData {
  userAddress: string
}

export default Form.create()(NewConversationDialog)
