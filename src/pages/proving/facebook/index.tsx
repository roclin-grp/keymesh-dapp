import * as React from 'react'
import { observer } from 'mobx-react'

import ProvingTextarea from '../../../components/ProvingTextarea'
import FacebookLogin from 'react-facebook-login'
import { FacebookProvingState , getFacebookClaim } from './FacebookProvingState'

import {
  Link,
} from 'react-router-dom'

interface IProps {
  state: FacebookProvingState
}

@observer
class FacebookProving extends React.Component<IProps> {
  public render() {
    const label = 'Facebook'
    const {
      username,
      isProving,
      claim,
      checkProof,
      uploadBindingProof,
      loginCallback,
      platform,
    } = this.props.state

    if (!isProving) {
      return <div>
        <h3>Prove your {label} identity</h3>
        <p>Please login and authorize</p>
        <FacebookLogin
          appId={process.env.REACT_APP_FACEBOOK_APP_ID!}
          autoLoad={false}
          fields="name"
          scope="user_posts"
          callback={loginCallback}
        />
        <br />
        <Link to="/profile">Cancel</Link>
      </div>
    }

    const text = getFacebookClaim(claim)
    const postURL = 'https://www.facebook.com/'
    return <div>
      <p>{username}</p>
      <p>@{platform}</p>
      <p>
        Finally, post your proof to Facebook.
            We'll ask for permission to read your posts,
            so that we can find this one afterwards.
          </p>
      <p>
        This is really important
            -- <b>the text must be the same as below, and make sure your post is public, like this</b>
      </p>
      <ProvingTextarea value={text} />

      <br />
      <a href={postURL} target="_blank">Post it now</a>

      <br />
      <Link to="/profile">Cancel</Link>

      <br />
      <a onClick={checkProof}>OK posted! Check for it!</a>

      <br />
      <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
    </div>
  }
}

export default FacebookProving
