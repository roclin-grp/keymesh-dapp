import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import RegisterRecord from '../../components/register-record'

import './index.css'

interface Iprops {
  store: Store
}

interface Istate {
}

@inject('store') @observer
class RegisterRecords extends React.Component<Iprops, Istate> {
  public componentDidMount() {
    this.props.store.loadRegisterRecords()
  }
  public componentWillUnmount() {
    this.props.store.clearStoreRegisterRecords()
  }
  public render() {
    const {
      registerRecords
    } = this.props.store
    return registerRecords.length > 0
      ? <ul>{
        registerRecords.map((record) => <RegisterRecord key={record.transactionHash} record={record} />)
      }</ul>
      : null
  }
}

export default RegisterRecords
