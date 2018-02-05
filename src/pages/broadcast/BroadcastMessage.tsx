import * as React from 'react'

import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import HashAvatar from '../../components/HashAvatar'
import Address from '../../components/Address'
import { IBroadcastMessage } from '../../stores/BroadcastMessagesStore'
import { UsersStore } from '../../stores/UsersStore'

import * as styles from './BroadcastMessage.css'
import { timeAgo } from '../../utils/time'
import { MESSAGE_STATUS_STR } from '../../stores/SessionStore'

interface IProps {
  message: IBroadcastMessage
  usersStore: UsersStore
}

@observer
export default class BroadcastMessage extends React.Component<IProps> {
  @observable
  private avatarHash: string = ''
  private time: number
  @observable
  private timeText: string = ''
  private updateTimeTimeout: number

  public async componentDidMount() {
    const {
      usersStore: {
        getAvatarHashByUserAddress,
      },
      message: {
        author,
        timestamp,
      },
    } = this.props
    const avatarHash = await getAvatarHashByUserAddress(author!)
    this.time = timestamp
    this.updateTimeText()
    runInAction(() => {
      this.avatarHash = avatarHash
    })
  }

  public componentWillUnmount() {
    window.clearTimeout(this.updateTimeTimeout)
  }

  render() {
    const { message } = this.props
    const content = message.message.trim().split('\n').map((item, key) => {
      return <>
        {item}<br/>
      </>
    })
    return <div className={styles.broadcastMessage}>
      <HashAvatar
        className={styles.avatar}
        shape="circle"
        size="large"
        hash={this.avatarHash}
      />
      <div>
        <p
          className={styles.addressAndTime}
        >
          Address: <Address address={message.author!} /> {this.timeText}
        </p>
        <p>{content}</p>
        <p>{MESSAGE_STATUS_STR[message.status!]}</p>
      </div>
    </div>
  }

  private updateTimeText() {
    runInAction(() => {
      this.timeText = timeAgo(this.time)
    })

    this.updateTimeTimeout = window.setTimeout(() => this.updateTimeText(), 60 * 1000)
  }
}
