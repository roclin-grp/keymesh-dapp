import * as React from 'react'
import { observer } from 'mobx-react'

import { GithubProvingData } from './GithubProvingData'
import ProvingTextarea from '../ProvingTextarea'

import {
  Link,
} from 'react-router-dom'
import { GITHUB_GIST_FILENAME, signedClaimToClaimText } from '../../../stores/SocialProofsStore'

import { Icon, Button, Input } from 'antd'
import * as styles from './index.css'

interface IProps {
  data: GithubProvingData
}

@observer
class GithubProving extends React.Component<IProps> {
  public render() {
    const label = 'Github'
    const { data } = this.props
    const {
      username,
      isProving,
      claim,
      checkProofButtonContent,
      checkProofButtonDisabled,
      platform,
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

    return <div>
      <div className={styles.iconContainer}>
        <Icon type={platform} className={styles.icon} />
      </div>
      <p><a href={'https://github.com/' + username} target="_blank">{username}</a></p>
      <p className={styles.notice}>
        Login to GitHub and paste the text below into a public gist called {GITHUB_GIST_FILENAME}.
      </p>
      <ProvingTextarea value={signedClaimToClaimText(claim!)} />

      <p>
        <a href="https://gist.github.com/" target="_blank">Create gist now</a>
      </p>
      <div>
        <Link to="/profile"><Button className={styles.cancel}>Cancel</Button></Link>
        <Button type="primary" onClick={() => data.checkProof()} disabled={checkProofButtonDisabled}>
          {checkProofButtonContent}
        </Button>
      </div>

    </div>
  }
}

export default GithubProving
