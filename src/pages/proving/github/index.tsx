import * as React from 'react'
import { observer } from 'mobx-react'

import { GithubProvingState, getGithubClaim } from './GithubProvingState'
import ProvingTextarea from '../../../components/ProvingTextarea'

import {
  Link,
} from 'react-router-dom'
import { GITHUB_GIST_FILENAME } from '../../../stores/BoundSocialsStore'

import { Icon, Button, Input } from 'antd'
import * as styles from './index.css'

interface IProps {
  state: GithubProvingState
}

@observer
class GithubProving extends React.Component<IProps> {
  public render() {
    const label = 'Github'
    const {
      username,
      updateUsername,
      continueHandler,
      isProving,
      claim,
      checkProof,
      checkProofButtonContent,
      checkProofButtonDisabled,
      platform,
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

    return <div>
      <div className={styles.iconContainer}>
        <Icon type={platform} className={styles.icon} />
      </div>
      <p><a href={'https://github.com/' + username} target="_blank">{username}</a></p>
      <p className={styles.notice}>
        Login to GitHub and paste the text below into a public gist called {GITHUB_GIST_FILENAME}.
      </p>
      <ProvingTextarea value={getGithubClaim(claim)} />

      <p>
        <a href="https://gist.github.com/" target="_blank">Create gist now</a>
      </p>
      <div>
        <Link to="/profile"><Button className={styles.cancel}>Cancel</Button></Link>
        <Button type="primary" onClick={checkProof} disabled={checkProofButtonDisabled}>
          {checkProofButtonContent}
        </Button>
      </div>

    </div>
  }
}

export default GithubProving
