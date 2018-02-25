import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores/index'
import { UsersStore } from '../../stores/UsersStore'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { BroadcastForm } from './BroadcastForm'
import HashAvatar from '../../components/HashAvatar'

import * as styles from './index.css'
import BroadcastMessage from './BroadcastMessage'
import { Divider } from 'antd'
import { sha3 } from '../../utils/cryptos'
import classnames from 'classnames'

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
    this.props.usersStore.userProofsStatesStore.clearCachedStores()
  }

  public render() {
    return <div className={classnames(styles.broadcast, 'container')}>
      {this.renderPostForm()}
      <div className={styles.messagesContainer}>
        {this.renderBroadcastMessages()}
      </div>
    </div>
  }

  private renderPostForm() {
    const { hasUser } = this.props.usersStore
    if (!hasUser) {
      return null
    }

    return (
      <>
        <div className={styles.postForm}>
          <HashAvatar
            className={styles.avatar}
            shape="circle"
            hash={this.props.usersStore.currentUserStore!.avatarHash}
          />
          <BroadcastForm
            broadcastMessagesStore={this.props.broadcastMessagesStore}
            disabled={!this.props.usersStore.currentUserStore!.isCryptoboxReady}
          />
        </div>
        <Divider/>
      </>
    )
  }

  private renderBroadcastMessages() {
    const messages = this.props.broadcastMessagesStore.broadcastMessages.map((message) => (
      <div key={sha3(`${message.author}${message.timestamp}${message.message}`)}>
        <BroadcastMessage
          userCachesStore={this.props.usersStore.userCachesStore}
          userProofsStateStore={this.props.usersStore.userProofsStatesStore.getUserProofsStateStore(message.author!)}
          message={message}
        />
        <Divider />
      </div>
    ))

    if (messages.length === 0) {
      return <p className={styles.noBroadcasts}>No broadcasts</p>
    }

    return messages
  }
}

export default Broadcast
