import * as React from 'react'

import { runInAction } from 'mobx'
import { inject, observer } from 'mobx-react'

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import HashAvatar from '../../components/HashAvatar'

import {
  MetaMaskStore,
} from '../../stores/MetaMaskStore'

import { Icon } from 'antd'
import {
  IStores,
} from '../../stores'

import { ProfileState } from './ProfileState'
import { UsersStore } from '../../stores/UsersStore'
import { ContractStore } from '../../stores/ContractStore'
import { getBEMClassNamesMaker } from '../../utils/classNames'
import { SOCIAL_MEDIAS } from '../../stores/BoundSocialsStore'

interface IParams {
  userAddress?: string
}

interface IProps extends RouteComponentProps<IParams> {
  usersStore: UsersStore
  contractStore: ContractStore
  metaMaskStore: MetaMaskStore
}

@inject(({
  usersStore,
  contractStore,
  metaMaskStore,
}: IStores) => ({
  usersStore,
  contractStore,
  metaMaskStore,
}))

@observer
class Profile extends React.Component<IProps> {
  public data: ProfileState

  constructor(props: IProps) {
    super(props)
    const {
      metaMaskStore: {
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
    return <>
      {this.getUserAvatar()}
      {this.socials}
    </>
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
