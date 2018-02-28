import * as React from 'react'
import { observer } from 'mobx-react'

import { TwitterProvingData } from './TwitterProvingData'
import ProvingTextarea from '../ProvingTextarea'

import {
  Link,
} from 'react-router-dom'
import { Icon, Button } from 'antd'
import * as styles from './index.css'
import { signedClaimToClaimText } from '../../../stores/BoundSocialsStore'
import ENV from '../../../config'

interface IProps {
  data: TwitterProvingData
}

@observer
class TwitterProving extends React.Component<IProps> {
  public componentWillMount() {
    if (window.location.search === '') {
      this.authorize()
      return
    }
  }

  public componentDidMount() {
    const url = ENV.TWITTER_OAUTH_CALLBACK + window.location.search
    history.pushState(null, '', window.location.href.split('?')[0])
    fetch(url)
      .then((resp) => resp.json())
      .then(async (body) => {
        this.props.data.updateUsername(body.screen_name)
        this.props.data.continueHandler()
      })
    // todo deal with 401
  }

  public render() {
    const label = 'Twitter'
    const { data } = this.props
    const {
      username,
      isProving,
      claim,
      platform,
      checkProofButtonContent,
      checkProofButtonDisabled,
    } = data

    if (!isProving) {
      return <div className={styles.container}>
        <div className={styles.iconContainer}>
          <Icon type={platform} className={styles.icon} />
        </div>
        <div className={styles.inputContainer}>
          <p>Fetching your {label} username</p>
        </div>

        <div className={styles.buttonsContainer}>
          <Link to="/profile">Cancel</Link>
        </div>
      </div>
    }

    const twitterClaimText = signedClaimToClaimText(claim!)
    const tweetClaimURL = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(twitterClaimText)
    return <div>
      <div className={styles.iconContainer}>
        <Icon type={platform} className={styles.icon} />
      </div>
      <p><a href={'https://twitter.com/' + username} target="_blank">{username}</a></p>
      <p className={styles.notice}>Please tweet the text below exactly as it appears.</p>
      <ProvingTextarea value={twitterClaimText}/>

      <div className={styles.tweetContainer}>
        <a href={tweetClaimURL} target="_blank">Tweet it now</a>
      </div>
      <div>
        <Link to="/profile"><Button className={styles.cancel}>Cancel</Button></Link>
        <Button type="primary" onClick={() => data.checkProof()} disabled={checkProofButtonDisabled}>
          {checkProofButtonContent}
        </Button>
      </div>
    </div>
  }

  private authorize() {
    fetch(ENV.TWITTER_OAUTH_API)
      .then((resp) => resp.text())
      .then((url) => window.location.href = url)
  }
}

export default TwitterProving
