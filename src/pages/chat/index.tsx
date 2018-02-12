import * as React from 'react'

// component
import MenuBody from '../../containers/MenuBody'
import Content from './Content'
import Loading from './Loading'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../stores'
import {
  UsersStore,
} from '../../stores/UsersStore'

@inject(({
  usersStore,
}: IStores) => ({
  usersStore,
}))
@observer
class Chat extends React.Component {
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  public render() {
    const currentUserStore = this.injectedProps.usersStore.currentUserStore!

    if (!currentUserStore.isCryptoboxReady) {
      return (
        <MenuBody routePath="/chat">
          <Loading message="Loading..." />
        </MenuBody>
      )
    }

    return (
      <MenuBody routePath="/chat">
        <Content userStore={currentUserStore!} />
      </MenuBody>
    )
  }
}

interface IInjectedProps {
  usersStore: UsersStore
}

export default Chat
