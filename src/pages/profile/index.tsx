import * as React from 'react'

import { runInAction , observable } from 'mobx'
import { inject, observer } from 'mobx-react'

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
import HashAvatar from '../../components/HashAvatar'
import {
  getBEMClassNamesMaker,
  noop,
} from '../../utils'

import {
  SOCIAL_MEDIAS,
} from '../../constants'

import {
  ETHEREUM_CONNECT_STATUS,
} from '../../stores/EthereumStore'

import { Icon } from 'antd'
import {
  Istores,
  UsersStore ,
  ContractStore,
  EthereumStore,
} from '../../stores'

import { ProfileState } from './ProfileState'

interface Iparams {
  userAddress?: string
}

interface Iprops extends RouteComponentProps<Iparams> {
  usersStore: UsersStore
  contractStore: ContractStore
  ethereumStore: EthereumStore
}

@inject(({
  usersStore,
  contractStore,
  ethereumStore,
}: Istores) => ({
  usersStore,
  contractStore,
  ethereumStore,
}))

@observer
class Profile extends React.Component<Iprops> {
  public data: ProfileState

  private readonly getBEMClassNames = getBEMClassNamesMaker('profile', this.props)
  private removeEthereumConnectStatusChangeListener = noop
  @observable
  private initializedState = false
  public componentDidMount(isFirstMount: boolean = true) {
    const {
      ethereumStore: {
        isActive,
        listenForEthereumConnectStatusChange,
        getBlockHash,
      },
      usersStore,
      contractStore,
    } = this.props
    const user = usersStore.hasUser ? usersStore.currentUserStore!.user : undefined

    if (isActive) {
      this.data = new ProfileState({usersStore, contractStore, getBlockHash})
      if (typeof this.props.match.params.userAddress !== 'undefined') {
        this.data.userAddress = this.props.match.params.userAddress
      }

      let userAddress = this.data.userAddress
      if (usersStore.hasUser) {
        if ('' === this.data.userAddress) {
          userAddress = user!.userAddress
          runInAction(() => {
            this.data.userAddress = userAddress
          })
        }
      }

      this.data.startFetchingUserProofs()
      this.data.startVerifyingUserProofs()
      runInAction(() => {
        this.initializedState = true
      })
    }

    if (isFirstMount) {
      this.removeEthereumConnectStatusChangeListener = listenForEthereumConnectStatusChange(this.connectStatusListener)
    }
  }

  public componentWillUnmount() {
    this.data.stopFetchingUserProofs()
    this.data.stopVerifyingUserProofs()
    this.removeEthereumConnectStatusChangeListener()
  }

  public render() {
    if (!this.initializedState) {
      return <CommonHeaderPage/>
    }

    return <CommonHeaderPage>
      {this.userAvatar}
      {this.socials}
    </CommonHeaderPage>
  }

  private get socials() {
    const socialsElements = []
    for (let social of SOCIAL_MEDIAS) {
      const boundSocial = this.data.userBoundSocials[social.platform]
      let stateText = null

      if (typeof boundSocial !== 'undefined') {
        stateText = <a>{boundSocial.username}@{social.platform} {this.data.verifyStatus[social.platform]}</a>
      } else if (this.data.isSelf) {
        stateText = <Link to={`/proving/${social.platform}`}>Prove your {social.label}</Link>
      }

      if (stateText !== null) {
        socialsElements.push(
          <li key={social.platform}>
            <Icon type={social.platform} style={{ marginRight: '5px' }} />
            {stateText}
          </li>
        )
      }
    }
    return <ul>{socialsElements}</ul>
  }

  private get userAvatar() {
    const { getBEMClassNames } = this
    const avatarShape = 'square'
    const avatarSize = 'large'
    const avatarClassName = getBEMClassNames('user-avatar')

    return <HashAvatar
      className={avatarClassName}
      shape={avatarShape}
      size={avatarSize}
      hash={this.data.avatarHash}
    />
  }

  private connectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => {
    if (prev !== ETHEREUM_CONNECT_STATUS.ACTIVE) {
      // fix me: this is an ugly way to call `this.componentDidMount` after assigning user
      const notFirstDidMount = () => {
        this.componentDidMount(false)
      }
      window.setTimeout(notFirstDidMount, 1000)
    } else if (cur !== ETHEREUM_CONNECT_STATUS.ACTIVE) {
      this.data.stopFetchingUserProofs()
      this.data.stopVerifyingUserProofs()
    }
  }
}

export default Profile
