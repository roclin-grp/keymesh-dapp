import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import RegisterRecord from '../../components/register-record'

import { IregisterRecord } from '../../../typings/interface.d'

import './index.css'

interface IinjectedProps {
  store: Store
}

@inject('store') @observer
class RegisterRecords extends React.Component<{}> {
  private get injectedProps() {
    return this.props as IinjectedProps
  }
  public componentDidMount() {
    this.injectedProps.store.loadRegisteringUser()
  }
  public componentWillUnmount() {
    this.injectedProps.store.clearRegisteringUser()
  }
  public render() {
    const {
      registeringUsers
    } = this.injectedProps.store
    return registeringUsers.length > 0
      ? (
        <ul>
          {
            registeringUsers.map((user) => (
              <RegisterRecord
                key={(user.registerRecord as IregisterRecord).identityTransactionHash}
                user={user}
              />
            ))
          }
        </ul>
      )
      : null
  }
}

export default RegisterRecords
