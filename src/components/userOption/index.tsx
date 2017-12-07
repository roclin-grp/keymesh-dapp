import * as React from 'react'

import {
  Iuser
} from '../../../typings/interface.d'

interface Iprops {
  user: Iuser
  onSelect: (user: Iuser) => void
}

interface Istate {
  showNetworks: boolean
}
class UserOption extends React.Component<Iprops, Istate> {
  public render() {
    const {
      user
    } = this.props
    return <li
      style={{
        cursor: 'pointer',
        fontSize: 14,
        height: 25,
        lineHeight: '25px',
        display: 'block',
        listStyle: 'none',
        padding: '10px 20px'
      }}
      title={user.usernameHash}
      onClick={this.handleClick}>
      {user.username}
    </li>
  }
  private handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const {
      user,
      onSelect
    } = this.props
    onSelect(user)
  }
}

export default UserOption
