import * as React from 'react'
import {
  Link,
} from 'react-router-dom'

import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import HashAvatar from '../../components/HashAvatar'
import UserAddress from '../../components/UserAddress'
import {
  IBroadcastMessage,
  MESSAGE_STATUS,
} from '../../stores/BroadcastMessagesStore'
import { UsersStore } from '../../stores/UsersStore'

import * as styles from './BroadcastMessage.css'
import { timeAgo } from '../../utils/time'
import * as classnames from 'classnames'

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
        userCachesStore: {
          getAvatarHashByUserAddress,
        },
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
    const userAddress = message.author!
    const messageStatus = message.status!

    return <div className={styles.broadcastMessage}>
      <HashAvatar
        className={styles.avatar}
        shape="circle"
        size="large"
        hash={this.avatarHash}
      />
      <div className={styles.body}>
        <p
          className={styles.addressAndTime}
        >
          <Link to={`/profile/${userAddress}`}>
            <UserAddress address={userAddress} />
          </Link>
          {` ${this.timeText}`}
        </p>
        <p className={styles.content}>{message.message}</p>
        {
          messageStatus !== MESSAGE_STATUS.DELIVERED
            ? (
              <p
                className={classnames(styles.status, MESSAGE_MODIFIER_CLASSES[messageStatus])}
              >
                {MESSAGE_STATUS_STR[messageStatus]}
              </p>
            )
            : null
        }
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

const MESSAGE_MODIFIER_CLASSES = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: styles.delivering,
  [MESSAGE_STATUS.FAILED]: styles.failed,
})

const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
})
