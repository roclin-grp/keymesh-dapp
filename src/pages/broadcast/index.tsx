import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores/index'
import { UsersStore } from '../../stores/UsersStore'
import { BroadcastMessagesStore } from '../../stores/BroadcastMessagesStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { BroadcastForm } from './BroadcastForm'
import UserAvatar from '../../components/UserAvatar'

import * as styles from './index.css'
import BroadcastMessage from './BroadcastMessage'
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
    return <div className={classnames('page-container')}>
      {this.renderPostForm()}
      {this.renderBroadcastMessages()}
    </div>
  }

  private renderPostForm() {
    const { currentUserStore } = this.props.usersStore
    if (currentUserStore == null) {
      return null
    }

    const { userAddress } = currentUserStore.user
    return (
      <section className={classnames(styles.postForm, 'block')}>
        <UserAvatar
          key={userAddress}
          className={styles.avatar}
          shape="circle"
          userAddress={userAddress}
        />
        <BroadcastForm
          disabled={currentUserStore.isDisabled}
          broadcastMessagesStore={this.props.broadcastMessagesStore}
        />
      </section>
    )
  }

  private renderBroadcastMessages() {
    const messages = this.props.broadcastMessagesStore.broadcastMessages.map((message) => (
      <BroadcastMessage
        key={sha3(`${message.author}${message.timestamp}${message.message}`)}
        userCachesStore={this.props.usersStore.userCachesStore}
        userProofsStateStore={this.props.usersStore.userProofsStatesStore.getUserProofsStateStore(message.author!)}
        message={message}
        status={message.status!}
      />
    ))

    if (messages.length === 0) {
      return (
        <section className={'block'}>
          <p className={styles.noBroadcasts}>No broadcasts</p>
        </section>
      )
    }

    return (
      <section className={classnames(styles.broadcasts, 'block')}>
        {messages}
      </section>
    )
  }
}

export default Broadcast
