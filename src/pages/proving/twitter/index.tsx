import * as React from 'react'
import { observer } from 'mobx-react'

import { TwitterProvingState, getTwitterClaim } from './TwitterProvingState'
import ProvingTextarea from '../../../components/ProvingTextarea'

import {
  Link,
} from 'react-router-dom'

interface Iprops {
  state: TwitterProvingState
}

@observer
class TwitterProving extends React.Component<Iprops> {
  public render() {
    const label = 'Twitter'
    const {
      username,
      updateUsername,
      continueHandler,
      isProving,
      claim,
      checkProof,
      uploadBindingProof,
      platform,
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

    const twitterClaimText = getTwitterClaim(claim)
    const tweetClaimURL = 'https://twitter.com/home?status=' + encodeURI(twitterClaimText)
    return <div>
      <p>{username}</p>
      <p>@{platform}</p>
      <p>Please tweet the text below exactly as it appears.</p>
      <ProvingTextarea value={twitterClaimText}/>

      <br />
      <a href={tweetClaimURL} target="_blank">Tweet it now</a>

      <br />
      <Link to="/profile">Cancel</Link>

      <br />
      <a onClick={checkProof}>OK posted! Check for it!</a>

      <br />
      <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
    </div>
  }
}

export default TwitterProving
