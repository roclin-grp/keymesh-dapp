import * as React from 'react'

// component
import {
  Icon,
  Collapse,
} from 'antd'
const Panel = Collapse.Panel
import ErrorPage from '../ErrorPage'

// style
import * as styles from './index.css'

import metaMaskLockedScreenshot from './meta-mask-screenshot-locked.png'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../stores'
import {
  MetaMaskStore,
} from '../../stores/MetaMaskStore'
import {
  UsersStore,
} from '../../stores/UsersStore'

@inject(({
  metaMaskStore,
  usersStore
}: IStores) => ({
  metaMaskStore,
  usersStore
}))
@observer
class MetaMaskConnectFailPage extends React.Component {
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  public render() {
    const {
      hasNoMetaMask,
      isLocked,
    } = this.injectedProps.metaMaskStore
    const iconWarningClass = styles.iconWarning
    switch (true) {
      case hasNoMetaMask: {
        return (
          <>
            <Icon type="exclamation-circle-o" className={iconWarningClass} />
            <h1>
              You need to install
              <a target="_blank" href="https://metamask.io/">MetaMask</a>
              before using this app.
            </h1>
          </>
        )
      }
      case isLocked: {
        return (
          <>
            <Icon type="lock" className={iconWarningClass} />
            <h1>You need to unlock MetaMask.</h1>
            <Collapse bordered={false} className={styles.collapse}>
              <Panel header={<h3>Why is MetaMask locked?</h3>} key="unlock-metamask">
                <div className={styles.collapseContent}>
                  <p>
                    MetaMask locks your account after a certain period of time automatically.
                    To unlock simply click on the MetaMask extension and type in your password.
                  </p>
                  <img
                    src={metaMaskLockedScreenshot}
                    alt="Screenshot of locked MetaMask interface"
                    className={styles.lockedMetaMaskScreenshot}
                  />
                </div>
              </Panel>
            </Collapse>
          </>
        )
      }
      default:
        return (
          <ErrorPage
            message="Can't connect to MetaMask!"
            errorStack={this.injectedProps.metaMaskStore.connectError!.stack}
          />
        )
    }
  }
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

export default MetaMaskConnectFailPage
