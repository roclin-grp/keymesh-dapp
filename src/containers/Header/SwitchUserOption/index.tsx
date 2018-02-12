import * as React from 'react'

import HashAvatar from '../../../components/HashAvatar'
import UserAddress from '../../../components/UserAddress'

import {
  IUser,
} from '../../../stores/UserStore'
import {
  UsersStore,
} from '../../../stores/UsersStore'

import * as styles from './index.css'

interface IProps {
  user: IUser
  onSelect: (user: IUser) => void
  className?: string
}

interface IState {
  showNetworks: boolean
}
class SwitchUserOption extends React.Component<IProps, IState> {
  public render() {
    const {
      user,
    } = this.props
    return (
      <a
        title={user.userAddress}
        onClick={this.handleClick}
      >
        <HashAvatar
          className={styles.userAvatar}
          size="small"
          hash={UsersStore.getAvatarHashByUser(user)}
        />
        <UserAddress address={user.userAddress} maxLength={8} />
      </a>
    )
  }
  private handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    this.props.onSelect(this.props.user)
  }
}

export default SwitchUserOption
