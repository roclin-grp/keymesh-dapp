import * as React from 'react'
import { observer } from 'mobx-react'

import { TwitterProvingState, getTwitterClaim } from './TwitterProvingState'
import ProvingTextarea from '../../../components/ProvingTextarea'

import {
  Link,
} from 'react-router-dom'
import { Icon, Button, Input } from 'antd'
import * as styles from './index.css'

interface IProps {
  state: TwitterProvingState
}

@observer
class TwitterProving extends React.Component<IProps> {
  public render() {
    const label = 'Twitter'
    const {
      username,
      updateUsername,
      continueHandler,
      isProving,
      claim,
      checkProof,
      platform,
      checkProofButtonContent,
      checkProofButtonDisabled,
    } = this.props.state

    if (!isProving) {
      return <div className={styles.container}>
        <div className={styles.iconContainer}>
          <Icon type={platform} className={styles.icon} />
        </div>
        <div className={styles.inputContainer}>
          <Input
            value={username}
            onChange={(e: any) => updateUsername(e.target.value)}
            placeholder={`Your ${label} username`}
            onPressEnter={continueHandler}
          />
        </div>

        <div className={styles.buttonsContainer}>
          <Link to="/profile"><Button className={styles.cancel}>Cancel</Button></Link>
          <Button type="primary" onClick={continueHandler}>Continue</Button>
        </div>
      </div>
    }

    const twitterClaimText = getTwitterClaim(claim)
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
        <Button type="primary" onClick={checkProof} disabled={checkProofButtonDisabled}>
          {checkProofButtonContent}
        </Button>
      </div>
    </div>
  }
}

export default TwitterProving
