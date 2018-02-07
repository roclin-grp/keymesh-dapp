import * as React from 'react'

import { runInAction } from 'mobx'
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
import { SOCIAL_MEDIAS, VERIFY_SOCIAL_STATUS } from '../../stores/BoundSocialsStore'

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

  public componentDidMount() {
    this.data.startFetchingUserProofs()
    this.data.startVerifyingUserProofs()
  }

  public componentWillUnmount() {
    this.data.stopFetchingUserProofs()
    this.data.stopVerifyingUserProofs()
  }

  public render() {
    return <div className={classnames(styles.flex, styles.container)}>
      <div className={styles.flex}>
        {this.getUserAvatar()}
        {this.getSocials()}
      </div>
    </div>
  }

  private getSocials() {
    const socialsElements = []
    for (const social of SOCIAL_MEDIAS) {
      const boundSocial = this.data.userBoundSocials[social.platform]
      let stateText = null
      let statusIcon = null
      let icon = null
      let element = null

      if (typeof boundSocial !== 'undefined') {
        icon = <Icon type={social.platform} className={styles.platformIcon} />
        if (this.data.verifyStatus[social.platform] === VERIFY_SOCIAL_STATUS.VALID) {
          stateText = <a>
          <span className={styles.blue}>{boundSocial.username}</span>
          <span className={styles.grey}> @{social.platform}</span>
          </a>
          statusIcon = <Icon className={styles.blue} type="check-circle"/>
        } else if (this.data.verifyStatus[social.platform] === VERIFY_SOCIAL_STATUS.INVALID) {
          stateText = <a className={styles.red}>
            {boundSocial.username}
            <span className={styles.grey}> @{social.platform}</span>
          </a>
          statusIcon = <Icon type="cross-circle"/>
        } else {
          stateText = <a className={styles.grey}>{boundSocial.username} @{social.platform}</a>
          statusIcon = <Icon className={styles.grey} type="clock-circle"/>
        }
        element = <li key={social.platform} className={classnames(styles.li)}>
          <div>
            {icon}
            {stateText}
          </div>
          <div>{statusIcon}</div>
        </li>
      } else if (this.data.isSelf) {
        icon = <Icon className={styles.platformIcon} type={social.platform}/>
        stateText = <>Prove your {social.label}</>
        statusIcon = <Icon type="right" />
        element = <Link to={`/proving/${social.platform}`}>
          <li key={social.platform} className={classnames(styles.flex, styles.li)}>
            <div>
              {icon}
              {stateText}
            </div>
            <div>{statusIcon}</div>
          </li>
        </Link>
      }

      if (stateText !== null) {
        socialsElements.push(element)
      }
    }
    return <ul className={styles.ul}>{socialsElements}</ul>
  }

  private getUserAvatar() {
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
