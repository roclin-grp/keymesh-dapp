import * as React from 'react'

import { inject, observer } from 'mobx-react'

import {
  Link,
  Redirect,
  RouteComponentProps,
} from 'react-router-dom'

import { Icon } from 'antd'

import ProvingState from './ProvingState'

import GithubProving from './github'
import TwitterProving from './twitter'
import FacebookProving from './facebook'

import { GithubProvingState } from './github/GithubProvingState'
import { TwitterProvingState } from './twitter/TwitterProvingState'
import { FacebookProvingState } from './facebook/FacebookProvingState'

import {
  IStores,
} from '../../stores'
import { UsersStore } from '../../stores/UsersStore'
import { ContractStore } from '../../stores/ContractStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { SOCIAL_MEDIA_PLATFORMS } from '../../stores/BoundSocialsStore'

interface IParams {
  platform: string
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
class Proving extends React.Component<IProps> {
  public data: ProvingState

  constructor(props: IProps) {
    super(props)

    const platform = props.match.params.platform
    const isValidPlatform = Object.values(SOCIAL_MEDIA_PLATFORMS).includes(platform)
    this.isValidPlatform = isValidPlatform
    if (isValidPlatform) {
      this.data = this.getSocialProvingState(platform as SOCIAL_MEDIA_PLATFORMS)
    }
  }

  private isValidPlatform: boolean = false

  public render() {
    const {
      hasUser,
    } = this.props.usersStore
    if (!hasUser) {
      return <Link to="/">Back to index</Link>
    }

    if (!this.isValidPlatform) {
      return <>
        <p>Invalid platform</p>
        <Link to="/profile">Back to profile</Link>
      </>
    }

    const {
      isFinished,
      platform,
    } = this.data

    let provingComponent
    if (platform === SOCIAL_MEDIA_PLATFORMS.GITHUB) {
      provingComponent = <GithubProving state={this.data as GithubProvingState} />
    } else if (platform === SOCIAL_MEDIA_PLATFORMS.TWITTER) {
      provingComponent = <TwitterProving state={this.data as TwitterProvingState} />
    } else if (platform === SOCIAL_MEDIA_PLATFORMS.FACEBOOK) {
      provingComponent = <FacebookProving state={this.data as FacebookProvingState} />
    }

    if (isFinished) {
      return <Redirect to="/profile" />
    }
    return <>
      <div style={{ marginBottom: '8px' }}>
        <Icon type={platform} style={{ fontSize: 60 }} />
        {provingComponent}
      </div>
      </>
  }

  private getSocialProvingState(platform: SOCIAL_MEDIA_PLATFORMS): ProvingState {
    switch (platform) {
      case SOCIAL_MEDIA_PLATFORMS.GITHUB:
        return new GithubProvingState(this.props.usersStore)
      case SOCIAL_MEDIA_PLATFORMS.TWITTER:
        return new TwitterProvingState(this.props.usersStore)
      case SOCIAL_MEDIA_PLATFORMS.FACEBOOK:
        return new FacebookProvingState(this.props.usersStore)
      default:
        throw new Error('unknown platform')
    }
  }
}

export default Proving
