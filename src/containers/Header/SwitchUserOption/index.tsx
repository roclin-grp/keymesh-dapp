import * as React from 'react'

import UserAvatar from '../../../components/UserAvatar'
import Username from '../../../components/Username'

import * as styles from './index.css'

import { IUser } from '../../../stores/UserStore'

class SwitchUserOption extends React.Component<IProps, IState> {
  public render() {
    const { user } = this.props
    const { userAddress } = user
    return (
      <a
        role="button"
        title={userAddress}
        onClick={this.handleClick}
      >
        <UserAvatar
          className={styles.userAvatar}
          size="small"
          userAddress={userAddress}
        />
        <Username userAddress={user.userAddress} maxLength={8} />
      </a>
    )
  }
  private handleClick: React.MouseEventHandler<HTMLAnchorElement> = () => {
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    this.props.onSelect(this.props.user)
  }
}

interface IProps {
  user: IUser
  onSelect: (user: IUser) => void
  className?: string
}

interface IState {
  showNetworks: boolean
}

export default SwitchUserOption
