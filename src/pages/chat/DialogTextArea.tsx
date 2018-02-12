
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
class DialogTextArea extends React.Component<IProps, IState> {
  public static initialState = {
    newSessionDraftMessage: '',
  }

  public readonly state: Readonly<IState> = DialogTextArea.initialState

  private textAreaElement: HTMLTextAreaElement | null = null

  private get hasSession() {
    return typeof this.props.sessionStore !== 'undefined'
  }

  public componentDidUpdate({sessionStore: prevSessionStore}: IProps) {
    const currentSessionStore = this.props.sessionStore
    if (prevSessionStore !== currentSessionStore) {
      this.setState(DialogTextArea.initialState)
      if (currentSessionStore && this.textAreaElement) {
        this.textAreaElement.focus()
      }
    }
  }

  public render() {
    const isSessionClosed = this.hasSession && this.props.sessionStore!.session.isClosed
    const disabled = this.props.isSending || isSessionClosed

    return (
      <Form className={this.props.className} onSubmit={this.props.isSending ? this.noopSubmit : this.handleSubmit}>
        <FormItem className={styles.textAreaWrapper}>
          <TextArea
            ref={this.getTextArea as any}
            autoFocus={this.hasSession}
            spellCheck={false}
            rows={4}
            disabled={disabled}
            value={this.hasSession ? this.props.sessionStore!.draftMessage : this.state.newSessionDraftMessage}
            onChange={this.handleChange}
            placeholder="Write a message"
            className={styles.textArea}
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

  private handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const {
      value: message,
    } = event.target

    if (this.hasSession) {
      this.props.sessionStore!.setDraft(message)
    } else {
      this.setState({
        newSessionDraftMessage: message,
      })
    }
  }

  private handleSubmit = (event: React.FormEvent<HTMLTextAreaElement>) => {
    event.preventDefault()

    const content = (this.hasSession
      ? this.props.sessionStore!.draftMessage
      : this.state.newSessionDraftMessage
    ).trimRight()

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
  sessionStore?: SessionStore
  onSubmit: (message: string) => void
}

interface IState {
  newSessionDraftMessage: string
}

export default DialogTextArea
