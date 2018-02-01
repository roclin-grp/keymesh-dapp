import * as React from 'react'

import { sha3 } from 'trustbase'

import {
  getBEMClassNamesMaker,
  IExtendableClassNamesProps
} from '../../utils/classNames'

import HashAvatar from '../../components/HashAvatar'

import {
  IUser,
  USER_STATUS,
} from '../../stores/UserStore'

import './index.css'

interface IProps extends IExtendableClassNamesProps {
  user: IUser
  onSelect: (user: IUser) => void
}

interface IState {
  showNetworks: boolean
}
class SwitchUserOption extends React.Component<IProps, IState> {
  public static readonly blockName = 'switch-user-option'

  private readonly getBEMClassNames = getBEMClassNamesMaker(SwitchUserOption.blockName, this.props)

  public render() {
    const {
      getBEMClassNames,
      props: {
        user
      }
    } = this
    return (
      <a
        className={getBEMClassNames()}
        title={user.userAddress}
        onClick={this.handleClick}
      >
        <HashAvatar
          className={getBEMClassNames('user-avatar')}
          size="small"
          hash={user.status !== USER_STATUS.PENDING
            ? sha3(`${user.userAddress}${user.blockHash}`)
            : ''
          }
        />
        <span className={getBEMClassNames('user-address')}>
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
