import * as React from 'react'

import { sha3 } from 'trustbase'

import {
  getBEMClassNamesMaker,
  IextendableClassNamesProps
} from '../../utils/classNames'

import HashAvatar from '../../components/HashAvatar'

import {
  Iuser,
  USER_STATUS,
} from '../../stores/UserStore'

import './index.css'

interface Iprops extends IextendableClassNamesProps {
  user: Iuser
  onSelect: (user: Iuser) => void
}

interface Istate {
  showNetworks: boolean
}
class SwitchUserOption extends React.Component<Iprops, Istate> {
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
