import * as React from 'react'

import { withRouter } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import { Iuser } from '../../../typings/interface'

import './index.css'

interface Iprops {
  history: {
    push: (path: string) => void
  }
  store: Store
  user: Iuser
}

interface Istate {
  isClicked: boolean
}

@inject('store') @observer
class RegisterRecord extends React.Component<Iprops, Istate> {
  public readonly state = {
    isClicked: false
  }
  public render() {
    const {
      user: {
        userAddress
      }
    } = this.props
    return <li className="record">
      <span
        className="username"
      >
        {userAddress}
      </span>
      <button disabled={this.state.isClicked} onClick={this.handleCheckRegister}>Continue</button>
    </li>
  }

  private handleCheckRegister = () => {
    const {
      user,
      store: {
        useUser
      },
      history: {
        push
      }
    } = this.props
    this.setState({
      isClicked: true
    })
    useUser(user, false, () => {
      if (!this) {
        return
      }
      this.setState({
        isClicked: false
      })
      push('/')
    }).catch(() => {/**/})
  }
}

export default withRouter(RegisterRecord as any)
