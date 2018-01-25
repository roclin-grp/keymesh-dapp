import * as React from 'react'

import { inject, observer } from 'mobx-react'
import FacebookLogin from 'react-facebook-login'

import {
  Link,
  Redirect,
  RouteComponentProps,
} from 'react-router-dom'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
import { Store } from '../../store'

import { Icon } from 'antd'
import {
  SOCIAL_MEDIA_PLATFORMS,
  SOCIAL_MEDIAS,
  GITHUB_GIST_FILENAME,
} from '../../constants'

import {
  ProvingState,
  getGithubClaim,
  getTwitterClaim,
  getFacebookClaim,
} from './ProvingState'

interface Iparams {
  platform: string
}
interface Iprops extends RouteComponentProps<Iparams> {
  store: Store
}

@inject('store') @observer
class Proving extends React.Component<Iprops> {
  public data: ProvingState

  constructor(props: Iprops) {
    super(props)

    const platform = props.match.params.platform
    const isValidPlatform = Object.values(SOCIAL_MEDIA_PLATFORMS).includes(platform)
    this.isValidPlatform = isValidPlatform
    if (isValidPlatform) {
      this.data = new ProvingState(props.store!, platform as SOCIAL_MEDIA_PLATFORMS)
    }
  }

  private isValidPlatform: boolean = false
  private claimTextarea: any

  public render() {
    const {
      currentUser,
    } = this.props.store
    if (typeof currentUser === 'undefined') {
      return <CommonHeaderPage>
        <Link to="/">Back to index</Link>
      </CommonHeaderPage>
    }

    if (!this.isValidPlatform) {
      return <CommonHeaderPage>
        <p>Invalid platform</p>
        <Link to="/profile">Back to profile</Link>
      </CommonHeaderPage>
    }

    const {
      username,
      githubClaim,
      twitterClaim,
      facebookClaim,
      isFinished,
      isProving,
      uploadBindingProof,
      platform,
    } = this.data

    let socialMedia: any = {}
    for (let sm of SOCIAL_MEDIAS) {
      if (sm.platform === platform) {
        socialMedia = sm
      }
    }

    const steps = (() => {
      if (!isProving) {
        if (platform === SOCIAL_MEDIA_PLATFORMS.FACEBOOK) {
          return <div>
            <h3>Prove your {socialMedia.label} identity</h3>
            <p>Please login and authorize</p>
            <FacebookLogin
              appId={process.env.REACT_APP_FACEBOOK_APP_ID!}
              autoLoad={false}
              fields="name"
              scope="user_posts"
              callback={this.data.facebookResponseCB}
            />
            <br />
            <Link to="/profile">Cancel</Link>
          </div>
        } else {
          return <div>
            <h3>Prove your {socialMedia.label} identity</h3>
            <input
              value={username}
              onChange={(e: any) => this.data.updateUsername(e.target.value)}
              placeholder={`Your ${socialMedia.label} username`}
            />
            <br />
            <Link to="/profile">Cancel</Link>
            <a onClick={this.data.continueHandler}>Continue</a>
          </div>
        }

      } else if (typeof githubClaim !== 'undefined') {
        return <div>
          <p>{username}</p>
          <p>@{platform}</p>
          <p>Login to GitHub and paste the text below into a public gist called {GITHUB_GIST_FILENAME}.</p>
          <textarea
            cols={80}
            rows={15}
            onClick={this.focusClaimTextarea}
            ref={(textarea) => { this.claimTextarea = textarea }}
            value={getGithubClaim(githubClaim)}
            readOnly={true}
          />

          <br />
          <a href="https://gist.github.com/" target="_blank">Create gist now</a>

          <br />
          <Link to="/profile">Cancel</Link>

          <br />
          <a onClick={this.data.checkGithubProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
        </div>
      } else if (typeof twitterClaim !== 'undefined') {
        const twitterClaimText = getTwitterClaim(twitterClaim)
        const tweetClaimURL = 'https://twitter.com/home?status=' + encodeURI(twitterClaimText)
        return <div>
          <p>{username}</p>
          <p>@{platform}</p>
          <p>Please tweet the text below exactly as it appears.</p>
          <textarea
            cols={80}
            rows={15}
            onClick={this.focusClaimTextarea}
            ref={(textarea) => { this.claimTextarea = textarea }}
            value={twitterClaimText}
            readOnly={true}
          />

          <br />
          <a href={tweetClaimURL} target="_blank">Tweet it now</a>

          <br />
          <Link to="/profile">Cancel</Link>

          <br />
          <a onClick={this.data.checkTwitterProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
        </div>
      } else if (typeof facebookClaim !== 'undefined') {
        const text = getFacebookClaim(facebookClaim)
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
          <textarea
            cols={80}
            rows={15}
            onClick={this.focusClaimTextarea}
            ref={(textarea) => { this.claimTextarea = textarea }}
            value={text}
            readOnly={true}
          />

          <br />
          <a href={postURL} target="_blank">Post it now</a>

          <br />
          <Link to="/profile">Cancel</Link>

          <br />
          <a onClick={this.data.checkFacebookProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={uploadBindingProof}>Upload the proof to blockchain!</a>
        </div>
      } else {
        return null
      }
    })()

    if (isFinished) {
      return <Redirect to="/profile" />
    }
    return <CommonHeaderPage>
      <div style={{marginBottom: '8px'}}>
        <Icon type={platform} style={{fontSize: 60}}/>
        {steps}
      </div>
    </CommonHeaderPage>
  }

  private focusClaimTextarea = () => {
    this.claimTextarea.focus()
    this.claimTextarea.select()
  }
}

export default Proving
