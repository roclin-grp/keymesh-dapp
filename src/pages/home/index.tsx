import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS
} from '../../constants'

import Header from '../../containers/header'
import { Link } from 'react-router-dom'

const {
  PENDING,
  OFFLINE,
  NO_ACCOUNT,
  CONTRACT_ADDRESS_ERROR,
  SUCCESS,
  ERROR
} = TRUSTBASE_CONNECT_STATUS

const HeaderWithStore = Header as any

interface Iprops {
  store: Store
}

interface Istate {
}

@inject('store') @observer
class Home extends React.Component<Iprops, Istate> {
  public render() {
    const {
      connectStatus,
      currentUser
    } = this.props.store
    switch (connectStatus) {
      case PENDING:
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            <pre>Connecting to trustbase...</pre>
          </div>
        </div>
      case SUCCESS:
      case OFFLINE:
      case NO_ACCOUNT:
      case CONTRACT_ADDRESS_ERROR:
      case ERROR:
        return <div>
          <HeaderWithStore />
          <div style={{
            textAlign: 'center'
          }}>
            {
              connectStatus === SUCCESS
              && currentUser
                ? <Link
                  to="/send"
                  style={{
                    margin: '0 auto 20px',
                    width: 200,
                    display: 'block',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    background: 'aquamarine',
                    color: 'white',
                  }}
                >
                  Compose
                </Link>
                : null
            }
            {
              currentUser
                ? 'Messages here'
                : 'No account'
            }
          </div>
        </div>
      default:
        return null
    }
  }
}

export default Home
