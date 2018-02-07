import * as React from 'react'
import { observer } from 'mobx-react'

import ProvingTextarea from '../../../components/ProvingTextarea'
import FacebookLogin from 'react-facebook-login'
import { FacebookProvingState , getFacebookClaim } from './FacebookProvingState'
import { Icon, Button } from 'antd'

import * as styles from './index.css'

import {
  Link,
} from 'react-router-dom'

interface IProps {
  state: FacebookProvingState
}

@observer
class FacebookProving extends React.Component<IProps> {
  public render() {
    const {
      username,
      isProving,
      claim,
      checkProof,
      loginCallback,
      platform,
      checkProofButtonDisabled,
      checkProofButtonContent,
    } = this.props.state

    if (!isProving) {
      return <div>
        <p className={styles.authorizeNotice}>Please login and authorize</p>
        <FacebookLogin
          appId={process.env.REACT_APP_FACEBOOK_APP_ID!}
          autoLoad={false}
          fields="name"
          scope="user_posts"
          callback={loginCallback}
        />
        <p className={styles.cancelLinkContainer}><Link className={styles.cancelLink} to="/profile">Cancel</Link></p>
      </div>
    }

    const text = getFacebookClaim(claim)
    const postURL = 'https://www.facebook.com/'
    return <div>
        <div className={styles.iconContainer}>
          <Icon type={platform} className={styles.icon} />
        </div>
      <p>{username}</p>
      <p>
        Finally, post your proof to Facebook.
            We'll ask for permission to read your posts,
            so that we can find this one afterwards.
          </p>
      <p>
        This is really important
            -- <span className={styles.notice}>
          the text must be the same as below, and make sure your post is public.
            </span>
      </p>
      <ProvingTextarea value={text} />

      <p>
        <a href={postURL} target="_blank">Post it now</a>
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

export default FacebookProving
