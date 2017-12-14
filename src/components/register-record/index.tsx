import * as React from 'react'

import { Link } from 'react-router-dom'

import { IregisterRecord } from '../../../typings/interface'

import './index.css'

interface Iprops {
  record: IregisterRecord
}

interface Istate {
}

class RegisterRecord extends React.Component<Iprops, Istate> {
  public render() {
    const {
      record: {
        username,
        usernameHash,
        networkId
      }
    } = this.props
    return <li className="record">
      <span
        className="username"
      >
        {username}
      </span>
      <span
        className="username-hash"
      >
        ({usernameHash.slice(0, 9)}...{usernameHash.slice(-4)})
      </span>
      <Link to={`/check-register/${networkId}/${usernameHash}`}>Continue</Link>
    </li>
  }
}

export default RegisterRecord
