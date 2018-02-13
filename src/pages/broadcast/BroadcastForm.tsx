import * as React from 'react'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { storeLogger } from '../../utils/loggers'

import * as styles from './BroadcastForm.css'

import { Input, Button } from 'antd'
const { TextArea } = Input

interface IProps {
  broadcastMessagesStore: BroadcastMessagesStore
  disabled: boolean
}

interface IState {
  message: string
}

export class BroadcastForm extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props)

    this.state = {
      message: '',
    }
  }

  public handlePublish = () => {
    this.props.broadcastMessagesStore.publishBroadcastMessage(this.state.message.trimRight(), {
      transactionDidCreate: () => {
        this.setState({message: ''})
      },
      publishDidComplete: () => {
        storeLogger.log('completed')
      },
      publishDidFail: (err: Error) => {
        storeLogger.error(err)
      },
    })
  }

  public handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({message: event.target.value})
  }

  public render() {
    return <div className={styles.broadcastForm}>
      <TextArea
        spellCheck={false}
        className={styles.textarea}
        placeholder="What's happening?"
        value={this.state.message}
        onChange={this.handleChange}
        autosize={{minRows: 5}}
      />
      <Button
        disabled={this.props.disabled}
        className={styles.postButton}
        type="primary"
        onClick={this.handlePublish}
      >
        Post
      </Button>
    </div>
  }
}
