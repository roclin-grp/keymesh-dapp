
import * as React from 'react'

// component
import {
  Form,
  Input,
  Button,
} from 'antd'
const FormItem = Form.Item
const {
  TextArea,
} = Input

// style
import * as styles from './DialogTextArea.css'

// state management
import {
  observer,
} from 'mobx-react'
import {
  SessionStore,
} from '../../stores/SessionStore'

@observer
class DialogTextArea extends React.Component<IProps> {
  private textAreaElement: HTMLTextAreaElement | null = null

  public componentDidUpdate({sessionStore: prevSessionStore}: IProps) {
    const currentSessionStore = this.props.sessionStore
    if (prevSessionStore !== currentSessionStore) {
      if (currentSessionStore && this.textAreaElement) {
        this.textAreaElement.focus()
      }
    }
  }

  public render() {
    const isSessionClosed = this.props.sessionStore.session.meta.isClosed
    const disabled = this.props.isSending || isSessionClosed || this.props.sessionStore.isDisabled

    return (
      <Form className={this.props.className} onSubmit={this.props.isSending ? this.noopSubmit : this.handleSubmit}>
        <FormItem className={styles.textAreaWrapper}>
          <TextArea
            // hack: antd's type definition is wrong
            ref={this.getTextArea as () => void}
            autoFocus={true}
            spellCheck={false}
            rows={6}
            disabled={disabled}
            value={this.props.sessionStore.draftMessage}
            onChange={this.handleChange}
            placeholder="Write a message"
            className={styles.textArea}
            onKeyUp={this.handleKeyboardSend}
          />
        </FormItem>
        <FormItem className={styles.submitButtonWrapper}>
          <Button
            className={styles.submitButton}
            loading={this.props.isSending}
            disabled={disabled}
            type="primary"
            htmlType="submit"
          >
            {this.props.buttonContent}
          </Button>
        </FormItem>
      </Form>
    )
  }

  private handleKeyboardSend: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    const { ctrlKey, metaKey, key } = event

    if (key === 'Enter' && (ctrlKey || metaKey)) {
      event.preventDefault()
      this.handleSubmit()
    }
  }

  private handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const {
      value: message,
    } = event.target

    this.props.sessionStore.setDraft(message)
  }

  private handleSubmit = (event?: React.FormEvent<HTMLTextAreaElement>) => {
    if (event) {
      event.preventDefault()
    }

    const content = this.props.sessionStore.draftMessage.trimRight()

    if (content === '') {
      return
    }

    this.props.onSubmit(content)
  }

  private noopSubmit = (event: React.FormEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
  }

  private getTextArea = (element: HTMLTextAreaElement | null) => {
    this.textAreaElement = element
  }
}

interface IProps {
  className?: string
  isSending: boolean
  buttonContent: React.ReactNode
  sessionStore: SessionStore
  onSubmit: (message: string) => void
}

export default DialogTextArea
