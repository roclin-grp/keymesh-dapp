import * as React from 'react'

import { inject, observer } from 'mobx-react'
import { Steps } from 'antd'
const Step = Steps.Step

import { Link, RouteComponentProps } from 'react-router-dom'

import ProvingData from './ProvingData'

import GithubProving from './github'
import TwitterProving from './twitter'
import FacebookProving from './facebook'

import { GithubProvingData } from './github/GithubProvingData'
import { TwitterProvingData } from './twitter/TwitterProvingData'
import { FacebookProvingData } from './facebook/FacebookProvingData'

import { IStores } from '../../stores'
import { PLATFORMS, PLATFORM_LABELS } from '../../stores/SocialProofsStore'

import * as styles from './index.css'
import classnames from 'classnames'
import { UsersStore } from '../../stores/UsersStore'
import { Lambda } from 'mobx'
import { sleep } from '../../utils'

@inject(mapStoreToProps)
@observer
class Proving extends React.Component<IProps> {
  private disposeProvingCompletedReaction: Lambda | undefined
  private unmounted = false

  public componentDidMount() {
    if (!this.props.isValidPlatform) {
      return
    }

    this.disposeProvingCompletedReaction = this.props.data!.onProvingCompleted(this.handleProvingCompleted)
  }

  public componentWillUnmount() {
    this.unmounted = true
    if (this.disposeProvingCompletedReaction != null) {
      this.disposeProvingCompletedReaction()
    }
  }

  public render() {
    if (!this.props.isValidPlatform) {
      return (
        <div className={classnames('page-container', 'center-align-column-container')}>
          <h2>
            Invalid platform
          </h2>
          <Link to="/profile">Back to profile</Link>
        </div>
      )
    }

    const data = this.props.data!

    return (
      <div className="page-container">
        <section className="block">
          <h2 className="title">
            Verify Your Address on {PLATFORM_LABELS[data.platform]}
          </h2>
          <p className="description">
            You will prove your address on social media, and publish proof on the blockchain
          </p>
          <div className={styles.stepWrapper}>
            <Steps size="small" current={data.currentStep}>
              {data.steps.map((item) => <Step key={item} title={item} />)}
            </Steps>
          </div>
          {this.renderProvingContent()}
        </section>
      </div>
    )
  }

  private renderProvingContent() {
    const data = this.props.data!

    if (data.isFinished) {
      return (
        <>
          <h3>Congrats! Verification completed!</h3>
          <Link to="/profile">Please click here if you are not redirected within a few seconds</Link>
        </>
      )
    }

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
    if (this.unmounted) {
      return
    }

    this.props.history.replace('/profile')
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

function mapStoreToProps(stores: IStores, ownProps: IProps) {
  const platform = ownProps.match.params.platform
  const isValidPlatform = Object.values(PLATFORMS).includes(platform)
  return {
    isValidPlatform,
    data: isValidPlatform ? getSocialProvingState(platform, stores.usersStore) : null,
  }
}

interface IParams {
  platform: PLATFORMS
}

interface IProps extends RouteComponentProps<IParams> {
  isValidPlatform: boolean
  data: ProvingData | null
}

export default Proving
