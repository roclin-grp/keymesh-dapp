import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import RegisterRecord from '../../components/register-record'

import { IregisterRecord } from '../../../typings/interface.d'

import './index.css'

interface Iprops {
  store: Store
}

const RegisterRecordWithStore = RegisterRecord as any

@inject('store') @observer
class RegisterRecords extends React.Component<Iprops> {
  public componentDidMount() {
    this.props.store.loadRegisteringUser()
  }
  public componentWillUnmount() {
    this.props.store.clearRegisteringUser()
  }
  public render() {
    const {
      registeringUsers
    } = this.props.store
    return registeringUsers.length > 0
      ? <ul>{
        registeringUsers.map((user) =>
          <RegisterRecordWithStore
            key={(user.registerRecord as IregisterRecord).identityTransactionHash}
            user={user}
          />)
      }</ul>
      : null
  }
}

export default RegisterRecords
