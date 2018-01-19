import * as React from 'react'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import { storeLogger } from '../../utils'

interface Iprops {
  store: Store
}

interface Istate {
  message: string
}

class BroadcastForm extends React.Component<Iprops, Istate> {
  constructor(props: Iprops) {
    super(props)

    this.state = {
      message: ''
    }
  }

  public handlePublish = () => {
    this.props.store.publishBoradcastMessage(this.state.message, {
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
    return <div>
      <textarea value={this.state.message} onChange={this.handleChange} />
      <button onClick={this.handlePublish}>Publish</button>
    </div>
  }
}

@inject('store') @observer
class Broadcast extends React.Component<Iprops> {
  public componentDidMount(isFirstMount: boolean = true) {
    const {
      startFetchBroadcast,
    } = this.props.store

    window.setTimeout(startFetchBroadcast, 1000)
  }

  public render() {
    const messagesElements = []
    for (let message of this.props.store.broadcastMessages) {
      const date = new Date(message.timestamp).toTimeString()
      messagesElements.push(
        <div>
          <p>Message: {message.message}</p>
          <p>Author: {message.author}  at: {date}</p>
        </div>
      )
    }

    return <CommonHeaderPage><div>Broadcast</div>
      <BroadcastForm store={this.props.store} />
      <div>{messagesElements}</div>
    </CommonHeaderPage>
  }
}

export default Broadcast
