import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  Istores,
} from '../../stores'
import {
  EthereumStore,
} from '../../stores/EthereumStore'
import {
  UsersStore,
} from '../../stores/UsersStore'

// helper
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class ErrorPage extends React.Component {
  public static readonly blockName = 'error-page'

  private readonly injectedProps = this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(ErrorPage.blockName, this.props)

  public render() {
    const {
      hasNotMetaMask,
      isMetaMaskLocked,
    } = this.injectedProps.ethereumStore
    switch (true) {
      case hasNotMetaMask: {
        return (
          <>
            <Icon type="exclamation-circle-o" className={this.getBEMClassNames('icon-warning')} />
            <h1>
              You need to install
              <a target="_blank" href="https://metamask.io/">MetaMask</a>
              before using this app.
            </h1>
          </>
        )
      }
      case isMetaMaskLocked: {
        return (
          <>
            <Icon type="lock" className={this.getBEMClassNames('icon-warning')} />
            <h1>You need to unlock MetaMask.</h1>
          </>
        )
      }
      default:
        return (
          <>
            <Icon type="close-circle-o" className={this.getBEMClassNames('icon-error')} />
            <h1>Something went wrong!</h1>
            <a target="_blank" href="https://github.com/ceoimon/keymail-webapp/issues/new">Report bugs</a>
            <details>
              <summary>{this.injectedProps.ethereumStore.ethereumConnectError!.message}</summary>
              <pre>{this.injectedProps.ethereumStore.ethereumConnectError!.stack}</pre>
            </details>
          </>
        )
    }
  }
}

interface IinjectedProps {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

export default ErrorPage
