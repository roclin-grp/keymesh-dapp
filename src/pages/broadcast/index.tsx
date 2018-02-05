import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores/index'
import { UsersStore } from '../../stores/UsersStore'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { BroadcastForm } from './BroadcastForm'
import  MenuBody  from '../../containers/MenuBody'
import HashAvatar from '../../components/HashAvatar'

import * as styles from './index.css'
import BroadcastMessage from './BroadcastMessage'
import { Divider } from 'antd'

interface IProps {
  usersStore: UsersStore
  metaMaskStore: MetaMaskStore,
  broadcastMessagesStore: BroadcastMessagesStore
}

@inject(({
  usersStore,
  metaMaskStore,
  broadcastMessagesStore,
}: IStores) => ({
  usersStore,
  metaMaskStore,
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
    let form
    if (this.props.usersStore.hasUser) {
      form = <div className={styles.postForm}>
        {this.userAvatar()}
        <BroadcastForm broadcastMessagesStore={this.props.broadcastMessagesStore}/>
      </div>
    }

    const messages = this.props.broadcastMessagesStore.broadcastMessages.map((message, index) => {
      return <>
        <BroadcastMessage usersStore={this.props.usersStore} message={message} key={index} />
        <Divider/>
      </>
    })
    return <MenuBody routePath="/discover">
      <div className={styles.broadcast}>
        {form}
        <div className={styles.messagesContainer}>
          <Divider/>
          <div>{messages}</div>
        </div>
      </div>
    </MenuBody>
  }

  private userAvatar() {
    const avatarShape = 'circle'
    const avatarSize = 'default'

    return <HashAvatar
      className={styles.avatar}
      shape={avatarShape}
      size={avatarSize}
      hash={this.props.usersStore.currentUserStore!.avatarHash}
    />
  }
}

export default Broadcast
