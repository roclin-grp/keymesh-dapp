import * as React from 'react'

import { runInAction } from 'mobx'
import { inject, observer } from 'mobx-react'
import { Steps } from 'antd'
const Step = Steps.Step

import {
  Link,
  Redirect,
  RouteComponentProps,
} from 'react-router-dom'

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
import { SOCIALS, SOCIAL_LABELS } from '../../stores/BoundSocialsStore'

import * as styles from './index.css'

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
  private isValidPlatform: boolean = false

  constructor(props: IProps) {
    super(props)

    const platform = props.match.params.platform
    const isValidPlatform = Object.values(SOCIALS).includes(platform)
    this.isValidPlatform = isValidPlatform
    if (isValidPlatform) {
      this.data = this.getSocialProvingState(platform as SOCIALS)
    }
  }

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
      currentStep,
    } = this.data

    let provingComponent
    if (platform === SOCIALS.GITHUB) {
      provingComponent = <GithubProving state={this.data as GithubProvingState} />
    } else if (platform === SOCIALS.TWITTER) {
      provingComponent = <TwitterProving state={this.data as TwitterProvingState} />
    } else if (platform === SOCIALS.FACEBOOK) {
      provingComponent = <FacebookProving state={this.data as FacebookProvingState} />
    }

    if (isFinished) {
      return <Redirect to="/profile" />
    }

    let body
    if (currentStep === 3) {
      window.setTimeout(
        () => {
          runInAction(() => {
            this.data.isFinished = true
          })
        },
        2000,
      )

      body = <div>
        <p className={styles.congratulations}>Congratulations!</p>
      </div>
    } else {
      body = <div className={styles.provingComponentContainer}>
        {provingComponent}
      </div>
    }

    const label = SOCIAL_LABELS[platform]

    return <div className={styles.content}>
      <h3 className={styles.provingNotice}>Prove your {label} identity</h3>

      <Steps size="small" current={this.data.currentStep}>
        {this.data.steps.map((item) => <Step key={item} title={item} />)}
      </Steps>

      {body}
    </div>
  }

  private getSocialProvingState(platform: SOCIALS): ProvingState {
    switch (platform) {
      case SOCIALS.GITHUB:
        return new GithubProvingState(this.props.usersStore)
      case SOCIALS.TWITTER:
        return new TwitterProvingState(this.props.usersStore)
      case SOCIALS.FACEBOOK:
        return new FacebookProvingState(this.props.usersStore)
      default:
        throw new Error('unknown platform')
    }
  }
}

export default Proving
