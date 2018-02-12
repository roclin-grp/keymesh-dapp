import * as React from 'react'

import { inject, observer } from 'mobx-react'

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import HashAvatar from '../../components/HashAvatar'

import * as styles from './index.css'
import * as classnames from 'classnames'

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
import { SOCIAL_LABELS, SOCIALS } from '../../stores/BoundSocialsStore'
import { UserCachesStore } from '../../stores/UserCachesStore'
import { VerifiedItem } from './VerifiedItem'

interface IParams {
  userAddress?: string
}

interface IProps extends RouteComponentProps<IParams> {
  usersStore: UsersStore
  contractStore: ContractStore
  metaMaskStore: MetaMaskStore
  userCachesStore: UserCachesStore
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
      usersStore,
      contractStore,
      match: {
        params: {
          userAddress: _userAddress,
        },
      },
    } = this.props

    const userAddress = _userAddress ? _userAddress : usersStore.currentUserStore!.user.userAddress
    this.data = new ProfileState({ usersStore, contractStore, userAddress})
  }

  public componentDidMount() {
    this.data.startFetchingUserProofs()
  }

  public componentWillUnmount() {
    this.data.stopFetchingUserProofs()
  }

  public render() {
    return <div className={classnames(styles.flex, styles.container)}>
      <div className={styles.flex}>
        {this.renderUserAvatar()}
        {this.renderSocials()}
      </div>
    </div>
  }

  private renderSocials() {
    const {
      userBoundSocials,
      isSelf,
      verifyStatuses,
      verifyFacebook,
      verifyTwitter,
      verifyGithub,
      isVerifying,
    } = this.data
    return <ul className={styles.ul}>
      {
        userBoundSocials.twitter ?
          <VerifiedItem
            platform={SOCIALS.TWITTER}
            isSelf={isSelf}
            isVerifying={isVerifying[SOCIALS.TWITTER]}
            boundSocial={userBoundSocials.twitter!}
            verifyStatus={verifyStatuses.twitter}
            verify={verifyTwitter}
          /> :
          isSelf ? this.renderProvingEntry(SOCIALS.TWITTER) : null
      }
      {
        userBoundSocials.github ?
          <VerifiedItem
            platform={SOCIALS.GITHUB}
            isSelf={isSelf}
            isVerifying={isVerifying[SOCIALS.GITHUB]}
            boundSocial={userBoundSocials.github!}
            verifyStatus={verifyStatuses.github}
            verify={verifyGithub}
          /> :
          isSelf ? this.renderProvingEntry(SOCIALS.GITHUB) : null
      }
      {
        userBoundSocials.facebook ?
          <VerifiedItem
            platform={SOCIALS.FACEBOOK}
            isSelf={isSelf}
            isVerifying={isVerifying[SOCIALS.FACEBOOK]}
            boundSocial={userBoundSocials.facebook!}
            verifyStatus={verifyStatuses.facebook}
            verify={verifyFacebook}
          /> :
          isSelf ? this.renderProvingEntry(SOCIALS.FACEBOOK) : null
      }
    </ul>
  }
  private renderProvingEntry(platform: SOCIALS) {
    return <Link to={`/proving/${platform}`}>
      <li className={styles.li}>
        <div>
          <Icon className={styles.platformIcon} type={platform} />
          Prove your {SOCIAL_LABELS[platform]}
        </div>
        <div><Icon type="right" /></div>
      </li>
    </Link>
  }

  private renderUserAvatar() {
    const avatarShape = 'circle'
    const avatarSize = 'large'

    return <HashAvatar
      shape={avatarShape}
      size={avatarSize}
      hash={this.data.avatarHash}
    />
  }
}

export default Profile
