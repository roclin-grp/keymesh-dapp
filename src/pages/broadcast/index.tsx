import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores/index'
import { UsersStore } from '../../stores/UsersStore'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { EthereumStore } from '../../stores/EthereumStore'
import { BroadcastForm } from './BroadcastForm'

interface IProps {
  usersStore: UsersStore
  ethereumStore: EthereumStore,
  broadcastMessagesStore: BroadcastMessagesStore
}

@inject(({
  usersStore,
  ethereumStore,
  broadcastMessagesStore,
}: IStores) => ({
  usersStore,
  ethereumStore,
  broadcastMessagesStore,
}))

@observer
class Broadcast extends React.Component<IProps> {
  public componentDidMount() {
    this.props.broadcastMessagesStore.startFetchBroadcastMessages()
  }

  public componentWillUnmount() {
    this.props.broadcastMessagesStore.stopFetchBroadcastMessages()
  }

  public render() {
    const messagesElements = []
    for (let message of this.props.broadcastMessagesStore.broadcastMessages) {
      const date = new Date(message.timestamp).toTimeString()
      messagesElements.push(
        <div>
          <p>Message: {message.message}</p>
          <p>Author: {message.author}  at: {date}</p>
        </div>
      )
    }

    let form
    if (this.props.usersStore.hasUser) {
      form = <BroadcastForm broadcastMessagesStore={this.props.broadcastMessagesStore} />
    }

    return <>
      <div>Broadcast</div>
      {form}
      <div>{messagesElements}</div>
      </>
  }
}

export default Broadcast
