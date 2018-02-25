import * as React from 'react'
import { observer } from 'mobx-react'

import ProvingTextarea from '../ProvingTextarea'
import FacebookLogin from 'react-facebook-login'
import { FacebookProvingData } from './FacebookProvingData'
import { Icon, Button } from 'antd'

import * as styles from './index.css'

import {
  Link,
} from 'react-router-dom'
import ENV from '../../../config'
import { signedClaimToClaimText } from '../../../stores/BoundSocialsStore'

interface IProps {
  data: FacebookProvingData
}

@observer
class FacebookProving extends React.Component<IProps> {
  public render() {
    const { data } = this.props
    const {
      username,
      isProving,
      claim,
      loginCallback,
      platform,
      checkProofButtonDisabled,
      checkProofButtonContent,
    } = data

    if (!isProving) {
      return <div>
        <p className={styles.authorizeNotice}>Please login and authorize</p>
        <FacebookLogin
          appId={ENV.FACEBOOK_APP_ID}
          autoLoad={false}
          fields="name"
          scope="user_posts"
          callback={loginCallback}
        />
        <p className={styles.cancelLinkContainer}><Link className={styles.cancelLink} to="/profile">Cancel</Link></p>
      </div>
    }

    const text = signedClaimToClaimText(claim!)
    const postURL = 'https://www.facebook.com/'
    return <div>
        <div className={styles.iconContainer}>
          <Icon type={platform} className={styles.icon} />
        </div>
      <p>{username}</p>
      <p>
        Please post the your proof to Facebook, the content must be exactly as below and make sure that is public.
      </p>
      <ProvingTextarea value={text} />

      <p>
        <a href={postURL} target="_blank">Post it now</a>
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

export default FacebookProving
