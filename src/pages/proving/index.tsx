import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Steps } from 'antd'
const Step = Steps.Step

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import ProvingData from './ProvingData'

import GithubProving from './github'
import TwitterProving from './twitter'
import FacebookProving from './facebook'

import { GithubProvingData } from './github/GithubProvingData'
import { TwitterProvingData } from './twitter/TwitterProvingData'
import { FacebookProvingData } from './facebook/FacebookProvingData'

import {
  IStores,
} from '../../stores'
import { PLATFORMS, PLATFORM_LABELS } from '../../stores/SocialProofsStore'

import * as styles from './index.css'
import { UsersStore } from '../../stores/UsersStore'
import { Lambda } from 'mobx'
import { sleep } from '../../utils'

interface IParams {
  platform: PLATFORMS
}
interface IProps {
  isValidPlatform: boolean
  data: ProvingData | null
}

type IPropsWithRouter = IProps & RouteComponentProps<IParams>

@inject(mapStoreToProps)
@observer
class Proving extends React.Component<IPropsWithRouter> {
  private disposeProvingCompletedReaction: Lambda | null = null
  private unmounted = false

  public componentDidMount() {
    if (!this.props.isValidPlatform) {
      return
    }

    this.disposeProvingCompletedReaction = this.props.data!.onProvingCompleted(this.handleProvingCompleted)
  }

  public componentWillUnmount() {
    this.unmounted = true
    if (this.disposeProvingCompletedReaction !== null) {
      this.disposeProvingCompletedReaction()
    }
  }

  public render() {
    if (!this.props.isValidPlatform) {
      return <>
        <p>Invalid platform</p>
        <Link to="/profile">Back to profile</Link>
      </>
    }

    const state = this.props.data!

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
    const data = this.props.data!
    const { platform } = data
    switch (platform) {
      case PLATFORMS.GITHUB:
        return <GithubProving data={data as GithubProvingData} />
      case PLATFORMS.TWITTER:
        return <TwitterProving data={data as TwitterProvingData} />
      case PLATFORMS.FACEBOOK:
        return <FacebookProving data={data as FacebookProvingData} />
      default:
        return null
    }
  }

  private handleProvingCompleted = async () => {
    // redirect to /profile in 2 sec after finished
    await sleep(2000)
    // do nothing if already left this page
    if (!this.unmounted) {
      this.props.history.replace('/profile')
    }
  }
}

function getSocialProvingState(platform: PLATFORMS, usersStore: UsersStore): ProvingData {
  switch (platform) {
    case PLATFORMS.GITHUB:
      return new GithubProvingData(usersStore)
    case PLATFORMS.TWITTER:
      return new TwitterProvingData(usersStore)
    case PLATFORMS.FACEBOOK:
      return new FacebookProvingData(usersStore)
    default:
      throw new Error('unknown platform')
  }
}

function mapStoreToProps(stores: IStores, ownProps: IPropsWithRouter): IProps {
  const platform = ownProps.match.params.platform
  const isValidPlatform = Object.values(PLATFORMS).includes(platform)
  return {
    isValidPlatform,
    data: isValidPlatform ? getSocialProvingState(platform, stores.usersStore) : null,
  }
}

export default Proving
