import * as React from 'react'

import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import HashAvatar from '../../components/HashAvatar'
import Address from '../../components/Address'
import { IReceviedBroadcastMessage } from '../../stores/BroadcastMessagesStore'
import { UsersStore } from '../../stores/UsersStore'

import * as styles from './BroadcastMessage.css'
import { timeAgo } from '../../utils/time'

interface IProps {
  message: IReceviedBroadcastMessage
  usersStore: UsersStore
}

@observer
export default class BroadcastMessage extends React.Component<IProps> {
  @observable
  private avatarHash: string = ''
  @observable
  private time: string = ''

  public async componentDidMount() {
    const {
      usersStore: {
        getAvatarHashByUserAddress,
      },
      message: {
        author,
        timestamp,
      }
    } = this.props
    const avatarHash = await getAvatarHashByUserAddress(author)
    runInAction(() => {
      this.avatarHash = avatarHash
      this.time = timeAgo(timestamp)
    })
  }

  render() {
    const m = this.props.message
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
          Address: <Address address={m.author} /> {this.time}
        </p>
        <p>{m.message}</p>
      </div>
    </div>
  }
}