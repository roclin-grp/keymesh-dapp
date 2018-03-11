import * as React from 'react'

// component
import Content from './Content'

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
import { uiLogger } from '../../utils/loggers'

@inject(({
  usersStore,
}: IStores) => ({
  usersStore,
}))
@observer
class Chat extends React.Component {
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  public render() {
    const { currentUserStore } = this.injectedProps.usersStore

    if (currentUserStore == null) {
      uiLogger.error('Trying to render Chat component without userStore')
      return null
    }

    return <Content userStore={currentUserStore} />
  }
}

interface IInjectedProps {
  usersStore: UsersStore
}

export default Chat
