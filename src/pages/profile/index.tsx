import * as React from 'react'

import { runInAction } from 'mobx'
import { inject, observer } from 'mobx-react'

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
import HashAvatar from '../../components/HashAvatar'

import {
  EthereumStore,
} from '../../stores/EthereumStore'

import { Icon } from 'antd'
import {
  Istores,
} from '../../stores'

import { ProfileState } from './ProfileState'
import { UsersStore } from '../../stores/UsersStore'
import { ContractStore } from '../../stores/ContractStore'
import { getBEMClassNamesMaker } from '../../utils/classNames'
import { SOCIAL_MEDIAS } from '../../stores/BoundSocialsStore'

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

  constructor(props: Iprops) {
    super(props)
    const {
      ethereumStore: {
        getBlockHash,
      },
      usersStore,
      contractStore,
    } = this.props

    this.data = new ProfileState({ usersStore, contractStore, getBlockHash })
    runInAction(() => {
      if (typeof this.props.match.params.userAddress !== 'undefined') {
        this.data.userAddress = this.props.match.params.userAddress
      } else {
        this.data.userAddress = usersStore.currentUserStore!.user.userAddress
      }
    })
  }
  private readonly getBEMClassNames = getBEMClassNamesMaker('profile', this.props)

  public componentDidMount() {
    this.data.startFetchingUserProofs()
    this.data.startVerifyingUserProofs()
  }

  public componentWillUnmount() {
    this.data.stopFetchingUserProofs()
    this.data.stopVerifyingUserProofs()
  }

  public render() {
    return <CommonHeaderPage>
      {this.getUserAvatar()}
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

  private getUserAvatar() {
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
}

export default Profile
