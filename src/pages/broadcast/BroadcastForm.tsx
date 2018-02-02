import * as React from 'react'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { storeLogger } from '../../utils/loggers'

import './BroadcastForm.css'

import { Input, Button } from 'antd'
import { getBEMClassNamesMaker } from '../../utils/classNames'
const { TextArea } = Input

interface IProps {
  broadcastMessagesStore: BroadcastMessagesStore
}

interface IState {
  message: string
}

export class BroadcastForm extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props)

    this.state = {
      message: ''
    }
  }

  private readonly getBEMClassNames = getBEMClassNamesMaker('broadcast-form', this.props)

  public handlePublish = () => {
    this.props.broadcastMessagesStore.publishBoradcastMessage(this.state.message, {
      transactionDidCreate: () => {
        this.setState({message: ''})
      },
      sendingDidComplete: () => {
        storeLogger.log('completed')
      },
      sendingDidFail: (err: Error) => {
        storeLogger.error(err)
      }
    })
  }

  public handleChange = (event: any) => {
    this.setState({message: event.target.value})
  }

  public render() {
    return <div className={this.getBEMClassNames()}>
      <TextArea
        className={this.getBEMClassNames('textarea')}
        placeholder="What's happing?"
        value={this.state.message}
        onChange={this.handleChange}
        autosize={{minRows: 5}}
      />
      <Button
        className={this.getBEMClassNames('post_button')}
        type="primary"
        onClick={this.handlePublish}
      >
        Post
      </Button>
    </div>
  }
}
