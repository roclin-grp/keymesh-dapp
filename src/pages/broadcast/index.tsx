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
import { sha3 } from '../../cryptos'
import * as classnames from 'classnames'

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
    let form: JSX.Element | null = null
    const { hasUser } = this.props.usersStore
    if (hasUser) {
      form = <div className={styles.postForm}>
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
    }

    const messages = this.props.broadcastMessagesStore.broadcastMessages.map((message) => {
      return <div key={sha3(`${message.author}${message.timestamp}${message.message}`)}>
        <BroadcastMessage
          userCachesStore={this.props.usersStore.userCachesStore}
          userProofsStateStore={this.props.usersStore.userProofsStatesStore.getUserProofsStateStore(
            this.props.metaMaskStore.currentEthereumNetwork!,
            message.author!,
          )}
          message={message}
        />
        <Divider />
      </div>
    })
    return <div className={classnames(styles.broadcast, 'container')}>
      {form}
      <div className={styles.messagesContainer}>
        {hasUser ? <Divider /> : null}
        <div>{messages}</div>
      </div>
    </div>
  }
}

export default Broadcast
