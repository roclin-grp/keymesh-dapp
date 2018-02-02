import * as React from 'react'

import { sha3 } from 'trustbase'

import HashAvatar from '../../components/HashAvatar'

import {
  IUser,
  USER_STATUS,
} from '../../stores/UserStore'

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
      user
    } = this.props
    return (
      <a
        title={user.userAddress}
        onClick={this.handleClick}
      >
        <HashAvatar
          className={styles.userAvatar}
          size="small"
          hash={user.status !== USER_STATUS.PENDING
            ? sha3(`${user.userAddress}${user.blockHash}`)
            : ''
          }
        />
        <span>
          {user.userAddress.slice(0, 8)}...
        </span>
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
