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
  BINDING_SOCIAL_STATUS,
  GITHUB_GIST_FILENAME,
} from '../../constants'

import {
  storeLogger, getGithubClaimByRawURL
} from '../../utils'

import {
  IgithubClaim,
  IsignedGithubClaim,
  ItwitterClaim,
  IsignedTwitterClaim,
  IbindingSocial,
  IsignedFacebookClaim,
  IfacebookClaim,
} from '../../../typings/proof.interface'

import { GithubResource } from '../../resources/github'
import { Itweet } from '../../resources/twitter'
import { FacebookResource } from '../../resources/facebook'

interface Iparams {
  platform: string
}
interface Iprops extends RouteComponentProps<Iparams> {
  store: Store
}

interface Istate {
  isProving: boolean
  username: string
  githubClaim?: IsignedGithubClaim
  twitterClaim?: IsignedTwitterClaim
  facebookClaim?: IsignedFacebookClaim
  successful: boolean
}

const getFacebookClaim = (signedClaim: IsignedFacebookClaim) => {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}

const getTwitterClaim = (signedClaim: IsignedTwitterClaim) => {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}

const getGithubClaim = (signedClaim: IsignedGithubClaim) => {
  const {
    githubClaim: claim,
    signature,
  } = signedClaim
  const claimStr = JSON.stringify(claim, undefined, '  ')
  return `### Keymail proof

I hereby claim:

  * I am ${claim.service.username} on github
  * I am ${claim.userAddress} on Keymail
  * I have a public key ${claim.publicKey}

To Claim this, I am signing this object:

\`\`\`json
${claimStr}
\`\`\`

with the key ${claim.publicKey}, yielding the signature:

\`\`\`
${signature}
\`\`\`
`
}

@inject('store') @observer
class Proving extends React.Component<Iprops, Istate> {
  constructor(props: Iprops) {
    super(props)

    this.platform = props.match.params.platform
    this.state = {
      isProving: false,
      username: '',
      successful: false,
    }
  }

  private claimTextarea: any
  private platform: string
  private facebookAccessToken: string
  private facebookUserID: string

  public render() {
    const {
      currentUser,
    } = this.props.store
    if (typeof currentUser === 'undefined') {
      return <CommonHeaderPage>
        <Link to="/">Back to index</Link>
      </CommonHeaderPage>
    }

    const platform = this.platform
    if (!Object.values(SOCIAL_MEDIA_PLATFORMS).includes(platform)) {
      return <CommonHeaderPage>
        <p>Invalid platform: {platform}</p>
        <Link to="/profile">Back to profile</Link>
      </CommonHeaderPage>
    }

    let socialMedia: any = {}
    for (let sm of SOCIAL_MEDIAS) {
      if (sm.platform === platform) {
        socialMedia = sm
      }
    }

    const steps = (() => {
      if (!this.state.isProving) {
        if (platform === SOCIAL_MEDIA_PLATFORMS.FACEBOOK) {
          const responseFacebook = (response: any) => {
            this.facebookAccessToken = response.accessToken
            this.facebookUserID = response.userID
            this.setState({username: response.name})

            storeLogger.info('Facebook AccessToken:' + this.facebookAccessToken)
            storeLogger.info('Facebook UserID:' + this.facebookUserID)
            this.handleContinue()
          }
          return <div>
            <h3>Prove your {socialMedia.label} identity</h3>
            <p>Please login and authorize</p>
            <FacebookLogin
              appId="162817767674605"
              autoLoad={false}
              fields="name"
              scope="user_posts"
              callback={responseFacebook}
            />
            <br />
            <Link to="/profile">Cancel</Link>
          </div>
        } else {
          return <div>
            <h3>Prove your {socialMedia.label} identity</h3>
            <input
              value={this.state.username}
              onChange={this.handleChange}
              placeholder={`Your ${socialMedia.label} username`}
            />
            <br />
            <Link to="/profile">Cancel</Link>
            <a onClick={this.handleContinue}>Continue</a>
          </div>
        }

      } else if (typeof this.state.githubClaim !== 'undefined') {
        return <div>
          <p>{this.state.username}</p>
          <p>@{this.platform}</p>
          <p>Login to GitHub and paste the text below into a public gist called {GITHUB_GIST_FILENAME}.</p>
          <textarea
            cols={80}
            rows={15}
            onClick={this.focusClaimTextarea}
            ref={(textarea) => { this.claimTextarea = textarea }}
            value={getGithubClaim(this.state.githubClaim)}
            readOnly={true}
          />

          <br />
          <a href="https://gist.github.com/" target="_blank">Create gist now</a>

          <br />
          <Link to="/profile">Cancel</Link>

          <br />
          <a onClick={this.checkGithubProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={this.uploadProof}>Upload the proof to blockchain!</a>
        </div>
      } else if (typeof this.state.twitterClaim !== 'undefined') {
        const twitterClaimText = getTwitterClaim(this.state.twitterClaim)
        const tweetClaimURL = 'https://twitter.com/home?status=' + encodeURI(twitterClaimText)
        return <div>
          <p>{this.state.username}</p>
          <p>@{this.platform}</p>
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
          <a onClick={this.checkTwitterProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={this.uploadProof}>Upload the proof to blockchain!</a>
        </div>
      } else if (typeof this.state.facebookClaim !== 'undefined') {
        const text = getFacebookClaim(this.state.facebookClaim)
        const postURL = 'https://www.facebook.com/'
        return <div>
          <p>{this.state.username}</p>
          <p>@{this.platform}</p>
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
          <a onClick={this.checkFacebookProof}>OK posted! Check for it!</a>

          <br />
          <a onClick={this.uploadProof}>Upload the proof to blockchain!</a>
        </div>
      } else {
        return null
      }
    })()

    if (this.state.successful) {
      return <Redirect to="/profile" />
    }
    return <CommonHeaderPage>
      <div style={{marginBottom: '8px'}}>
        <Icon type={platform} style={{fontSize: 60}}/>
        {steps}
      </div>
    </CommonHeaderPage>
  }

  private uploadProof = async () => {
    this.props.store.uploadBindingSocials({
      transactionDidCreate: () => {
        storeLogger.log('created')
      },
      sendingDidComplete: () => {
        storeLogger.log('completed')
        this.setState({ successful: true })
      }
    })
  }
  private checkFacebookProof = async () => {
    if (typeof this.state.facebookClaim === 'undefined') {
      return
    }

    const text = getFacebookClaim(this.state.facebookClaim)
    const proofPost = await FacebookResource.getPosts(this.facebookUserID, this.facebookAccessToken)
      .then(posts => {
        for (let post of posts) {
          if (!post.hasOwnProperty('message')) {
            continue
          }
          if (text === post.message) {
            return post
          }
        }
        return null
      })
    if (proofPost === null) {
      alert('cloud not found claim!')
      return
    }

    const parts = proofPost.id.split('_')
    const postID = parts[1]
    const bindingSocial: IbindingSocial = {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: this.state.facebookClaim,
      proofURL: `https://www.facebook.com/${this.facebookUserID}/posts/${postID}`,
      username: this.state.username,
    }

    this.props.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.FACEBOOK, bindingSocial)
    alert('Congratulations! the claim is verified!')
  }
  private checkTwitterProof = async () => {
    if (typeof this.state.twitterClaim === 'undefined') {
      return
    }

    const {
      twitterResource
    } = this.props.store
    if (typeof twitterResource === 'undefined') {
      // todo deal with could not get twitter resource
      return
    }

    const tweets = await twitterResource.getUserTimeline(this.state.username)

    const _claimText = getTwitterClaim(this.state.twitterClaim)
    let claimTweet: Itweet|undefined
    for (let tweet of tweets) {
      if (tweet.full_text === _claimText) {
        storeLogger.log(JSON.stringify(tweet))
        claimTweet = tweet
        break
      }
    }

    if (typeof claimTweet === 'undefined') {
      alert('cloud not found claim!')
      return
    }

    const bindingSocial: IbindingSocial = {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: this.state.twitterClaim,
      proofURL: `https://twitter.com/statuses/${claimTweet.id_str}`,
      username: this.state.username,
    }
    this.props.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.TWITTER, bindingSocial)
    alert('Congratulations! the claim is verified!')
  }

  private checkGithubProof = async () => {
    const gists = await GithubResource.getGists(this.state.username)

    let proofURL: string = ''
    let proofRawURL: string = ''
    for (let gist of gists) {
      if (Object.keys(gist.files).includes(GITHUB_GIST_FILENAME)) {
        proofURL = gist.html_url
        proofRawURL = gist.files[GITHUB_GIST_FILENAME].raw_url
        break
      }
    }
    if (proofURL === '') {
      // did not find the contract
      alert('could not found proof url')
      return
    }

    const signedClaim: IsignedGithubClaim|null = await getGithubClaimByRawURL(proofRawURL)
    if (signedClaim === null) {
      // do something here with a mismatch
      alert('text could not match')
      return
    }

    if (JSON.stringify(this.state.githubClaim) === JSON.stringify(signedClaim)) {
      const bindingSocial: IbindingSocial = {
        status: BINDING_SOCIAL_STATUS.CHECKED,
        signedClaim: signedClaim,
        proofURL: proofURL,
        username: signedClaim.githubClaim.service.username
      }
      this.props.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.GITHUB, bindingSocial)
      alert('Congratulations! the claim is verified!')
    } else {
      alert('the claim is not match')
    }
  }

  private focusClaimTextarea = () => {
    this.claimTextarea.focus()
    this.claimTextarea.select()
  }

  private handleContinue = async () => {
    const {
      currentUser,
      getCurrentUserPublicKey
    } = this.props.store

    if (typeof currentUser === 'undefined') {
      return
    }

    const currentUserPublicKey = await getCurrentUserPublicKey()

    switch (this.platform) {
      case SOCIAL_MEDIA_PLATFORMS.GITHUB:
        const githubClaim: IgithubClaim = {
          userAddress: currentUser.userAddress,
          service: {
            name: SOCIAL_MEDIA_PLATFORMS.GITHUB,
            username: this.state.username,
          },
          ctime: Math.floor(Date.now() / 1000),
          publicKey: currentUserPublicKey,
        }
        const githubSignature = '0x' + this.props.store.currentUserSign(JSON.stringify(githubClaim))
        const signedGithubClaim: IsignedGithubClaim = {
          githubClaim,
          signature: githubSignature,
        }
        this.setState({
          isProving: true,
          githubClaim: signedGithubClaim
        })
        break
      case SOCIAL_MEDIA_PLATFORMS.TWITTER:
        const twitterClaim: ItwitterClaim = {
          userAddress: currentUser.userAddress,
          publicKey: currentUserPublicKey,
        }
        const twitterSignature = '0x' + this.props.store.currentUserSign(JSON.stringify(twitterClaim))
        this.setState({
          isProving: true,
          twitterClaim: {
            claim: twitterClaim,
            signature: twitterSignature,
          },
        })
        break
      case SOCIAL_MEDIA_PLATFORMS.FACEBOOK:
        const facebookClaim: IfacebookClaim = {
          userAddress: currentUser.userAddress,
          publicKey: currentUserPublicKey,
        }
        const facebookSignature = '0x' + this.props.store.currentUserSign(JSON.stringify(facebookClaim))
        this.setState({
          isProving: true,
          facebookClaim: {
            claim: facebookClaim,
            signature: facebookSignature,
          },
        })
        break
      default:
    }
  }

  private handleChange = (e: any) => {
    this.setState({username: e.target.value})
  }
}

export default Proving
