import * as React from 'react'

import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import HashAvatar from '../../components/HashAvatar'
import Address from '../../components/Address'
import { getBEMClassNamesMaker, IExtendableClassNamesProps } from '../../utils/classNames'
import { IReceviedBroadcastMessage } from '../../stores/BroadcastMessagesStore'
import { UsersStore } from '../../stores/UsersStore'

import './BroadcastMessage.css'
import { timeAgo } from '../../utils/time'

interface IProps extends IExtendableClassNamesProps {
  message: IReceviedBroadcastMessage
  usersStore: UsersStore
}

@observer
export default class BroadcastMessage extends React.Component<IProps> {
  @observable
  private avatarHash: string = ''
  @observable
  private time: string = ''

  private readonly getBEMClassNames = getBEMClassNamesMaker('broadcast-message', this.props)
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
    return <div className={this.getBEMClassNames()}>
      <HashAvatar
        className={this.getBEMClassNames('avatar')}
        shape="circle"
        size="large"
        hash={this.avatarHash}
      />
      <div>
        <p
          className={this.getBEMClassNames('address_and_time')}
        >
          Address: <Address address={m.author} /> {this.time}
        </p>
        <p>{m.message}</p>
      </div>
    </div>
  }
}