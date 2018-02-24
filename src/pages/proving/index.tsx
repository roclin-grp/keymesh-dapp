import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Steps } from 'antd'
const Step = Steps.Step

import {
  Link,
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
import { PLATFORMS, PLATFORM_LABELS } from '../../stores/BoundSocialsStore'

import * as styles from './index.css'
import { UsersStore } from '../../stores/UsersStore'
import { Lambda } from 'mobx'
import { sleep } from '../../utils'

interface IParams {
  platform: PLATFORMS
}
interface IProps {
  isValidPlatform: boolean
  state: ProvingState | null
}

type IPropsWithRouter = IProps & RouteComponentProps<IParams>

@inject(mapStoreToProps)
@observer
class Proving extends React.Component<IPropsWithRouter> {
  private finishedReactionDisposer: Lambda | null = null
  private unmounted = false

  public componentDidMount() {
    if (!this.props.isValidPlatform) {
      return
    }

    this.finishedReactionDisposer = this.props.state!.setupFinishedReaction(async () => {
      // redirect to /profile in 2 sec after finished
      await sleep(2000)
      // do nothing if already left this page
      if (!this.unmounted) {
        this.props.history.replace('/profile')
      }
    })
  }

  public componentWillUnmount() {
    this.unmounted = true
    if (this.finishedReactionDisposer !== null) {
      this.finishedReactionDisposer()
    }
  }

  public render() {
    if (!this.props.isValidPlatform) {
      return <>
        <p>Invalid platform</p>
        <Link to="/profile">Back to profile</Link>
      </>
    }

    const state = this.props.state!

    return <div className={styles.content}>
      <h3 className={styles.provingNotice}>Prove your {PLATFORM_LABELS[state.platform]} identity</h3>

      <Steps size="small" current={state.currentStep}>
        {state.steps.map((item) => <Step key={item} title={item} />)}
      </Steps>

      {
        state.isFinished
        ? (
          <div>
            <p className={styles.congratulations}>Congrats! Verification completed!</p>
            <Link to="/profile">Please click here if you are not redirected within a few seconds</Link>
          </div>
        )
        : (
          <div className={styles.provingComponentContainer}>
            {this.renderProving()}
          </div>
        )
      }
    </div>
  }

  private renderProving() {
    const state = this.props.state!
    const { platform } = state
    switch (platform) {
      case PLATFORMS.GITHUB:
        return <GithubProving state={state as GithubProvingState} />
      case PLATFORMS.TWITTER:
        return <TwitterProving state={state as TwitterProvingState} />
      case PLATFORMS.FACEBOOK:
        return <FacebookProving state={state as FacebookProvingState} />
      default:
        return null
    }
  }
}

function getSocialProvingState(platform: PLATFORMS, usersStore: UsersStore): ProvingState {
  switch (platform) {
    case PLATFORMS.GITHUB:
      return new GithubProvingState(usersStore)
    case PLATFORMS.TWITTER:
      return new TwitterProvingState(usersStore)
    case PLATFORMS.FACEBOOK:
      return new FacebookProvingState(usersStore)
    default:
      throw new Error('unknown platform')
  }
}

function mapStoreToProps(stores: IStores, ownProps: IPropsWithRouter): IProps {
  const platform = ownProps.match.params.platform
  const isValidPlatform = Object.values(PLATFORMS).includes(platform)
  return {
    isValidPlatform,
    state: isValidPlatform ? getSocialProvingState(platform, stores.usersStore) : null,
  }
}

export default Proving
