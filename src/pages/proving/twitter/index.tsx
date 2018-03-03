import * as React from 'react'
import { observer } from 'mobx-react'

import { TwitterProvingData } from './TwitterProvingData'
import ProvingTextarea from '../ProvingTextarea'

import {
  Link,
} from 'react-router-dom'
import { Icon, Button, Input } from 'antd'
import * as styles from './index.css'
import { signedClaimToClaimText } from '../../../stores/SocialProofsStore'

interface IProps {
  data: TwitterProvingData
}

@observer
class TwitterProving extends React.Component<IProps> {
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
          <Input
            spellCheck={false}
            value={username}
            onChange={(e: any) => data.updateUsername(e.target.value)}
            placeholder={`Your ${label} username`}
            onPressEnter={() => data.continueHandler()}
          />
        </div>

        <div className={styles.buttonsContainer}>
          <Link to="/profile"><Button className={styles.cancel}>Cancel</Button></Link>
          <Button type="primary" onClick={() => data.continueHandler()}>Continue</Button>
        </div>
      </div>
    }

    const twitterClaimText = signedClaimToClaimText(claim!)
    const tweetClaimURL = 'https://twitter.com/home?status=' + encodeURI(twitterClaimText)
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
}

export default TwitterProving
