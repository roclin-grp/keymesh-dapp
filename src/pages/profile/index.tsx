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

import { UserProofsStateStore } from '../../stores/UserProofsStateStore'
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
  proofsStateStore: UserProofsStateStore
}

@inject((
  {
    usersStore,
    contractStore,
    metaMaskStore,
  }: IStores,
  {
    match: {
      params: {
        userAddress,
      },
    },
  }: IProps,
) => ({
  usersStore,
  contractStore,
  metaMaskStore,
  proofsStateStore: usersStore.userProofsStatesStore.getUserProofsStateStore(
    metaMaskStore.currentEthereumNetwork!, userAddress || usersStore.currentUserStore!.user.userAddress
  ),
}))

@observer
class Profile extends React.Component<IProps> {
  private get isSelf() {
    const {
      usersStore,
    } = this.props
    const {
      userAddress,
    } = this.props.match.params
    const hasParams = typeof userAddress !== 'undefined'

    return !hasParams || usersStore.isCurrentUser(
      this.props.metaMaskStore.currentEthereumNetwork!, userAddress!
    )
  }

  public componentDidMount() {
    this.proofsStateStoreDidload(this.props.proofsStateStore)
  }

  public componentWillUnmount() {
    this.proofsStateStoreWillUnload(this.props.proofsStateStore)
  }

  public componentWillUpdate({proofsStateStore: nextProofsStateStore}: IProps) {
    const currentProofsStateStore = this.props.proofsStateStore
    if (nextProofsStateStore !== currentProofsStateStore) {
      this.proofsStateStoreWillUnload(currentProofsStateStore)
    }
  }

  public componentDidUpdate({proofsStateStore: prevProofsStateStore}: IProps) {
    const currentProofsStateStore = this.props.proofsStateStore
    if (prevProofsStateStore !== currentProofsStateStore) {
      this.proofsStateStoreDidload(currentProofsStateStore)
    }
  }

  public render() {
    return <div className={classnames(styles.flex, styles.container)}>
      <div className={styles.flex}>
        {this.renderUserAvatar()}
        {this.renderSocials()}
      </div>
    </div>
  }

  private renderLoadingProofs() {
    return this.props.proofsStateStore.isLoadingProofs ? <p>Loading proofs...</p> : null
  }

  private renderNoSocials() {
    const {
      userBoundSocials: socials,
      isLoadingProofs,
    } = this.props.proofsStateStore
    const {isSelf} = this

    if (!socials.facebook && !socials.github && !socials.twitter && !isSelf && !isLoadingProofs) {
      return <p>User haven't bound any socials</p>
    }
    return null
  }

  private renderSocials() {
    const {
      userBoundSocials,
      verifyStatuses,
      verifyFacebook,
      verifyTwitter,
      verifyGithub,
      isVerifying,
    } = this.props.proofsStateStore
    const {isSelf} = this
    return <ul className={styles.ul}>
      {this.renderLoadingProofs()}
      {this.renderNoSocials()}
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
      hash={this.props.proofsStateStore.avatarHash}
    />
  }

  private proofsStateStoreWillUnload(store: UserProofsStateStore) {
    if (store.isFetchingUserProofs) {
      store.stopFetchingUserProofs()
    }
  }

  private proofsStateStoreDidload(store: UserProofsStateStore) {
    if (store.isFetchingUserProofs) {
      store.stopFetchingUserProofs()
    }
    // more frequent than broadcast
    store.startFetchingUserProofs(5000)
  }
}

export default Profile
