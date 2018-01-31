import * as React from 'react'
import { observer } from 'mobx-react'

import { GithubProvingState, getGithubClaim } from './GithubProvingState'
import ProvingTextarea from '../../../components/ProvingTextarea'

import {
  Link,
} from 'react-router-dom'

import { GITHUB_GIST_FILENAME } from '../../../constants'

interface Iprops {
  state: GithubProvingState
}

@observer
class GithubProving extends React.Component<Iprops> {
  public render() {
    const label = 'Github'
    const {
      username,
      updateUsername,
      continueHandler,
      isProving,
      claim,
      checkProof,
      uploadBindingProof,
    } = this.props.state

    if (!isProving) {
      return <div>
        <h3>Prove your {label} identity</h3>
        <input
          value={username}
          onChange={(e: any) => updateUsername(e.target.value)}
          placeholder={`Your ${label} username`}
        />
        <br />
        <Link to="/profile">Cancel</Link>
        <a onClick={continueHandler}>Continue</a>
      </div>
    }

    return <div>
      <p>{username}</p>
      <p>@{label}</p>
      <p>Login to GitHub and paste the text below into a public gist called {GITHUB_GIST_FILENAME}.</p>
      <ProvingTextarea value={getGithubClaim(claim)} />

      <br />
      <a href="https://gist.github.com/" target="_blank">Create gist now</a>

      <br />
      <Link to="/profile">Cancel</Link>

      <br />
      <a onClick={checkProof}>OK posted! Check for it!</a>

      <br />
      <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
    </div>
  }
}

export default GithubProving
