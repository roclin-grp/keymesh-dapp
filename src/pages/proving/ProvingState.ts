import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import { Store } from '../../store'

import {
  SOCIAL_MEDIA_PLATFORMS,
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

useStrict(true)

export class ProvingState {
  @observable public githubClaim: IsignedGithubClaim
  @observable public twitterClaim: IsignedTwitterClaim
  @observable public facebookClaim: IsignedFacebookClaim

  @observable public isFinished: boolean
  @observable public isProving: boolean
  @observable public username: string

  constructor(private store: Store, public platform: SOCIAL_MEDIA_PLATFORMS) {
  }

  private facebookAccessToken: string
  private facebookUserID: string

  public continueHandler = async () => {
    const {
      currentUser,
      getCurrentUserPublicKey
    } = this.store
    const publicKey = await getCurrentUserPublicKey()
    const username = this.username
    const userAddress = currentUser!.userAddress

    switch (this.platform) {
      case SOCIAL_MEDIA_PLATFORMS.GITHUB:
        runInAction(() => {
          this.isProving = true
          this.githubClaim = this.generateSignedGithubClaim(username, userAddress, publicKey)
        })
        break
      case SOCIAL_MEDIA_PLATFORMS.TWITTER:
        runInAction(() => {
          this.isProving = true
          this.twitterClaim = this.generateSignedTwitterClaim(username, userAddress, publicKey)
        })
        break
      case SOCIAL_MEDIA_PLATFORMS.FACEBOOK:
        runInAction(() => {
          this.isProving = true
          this.facebookClaim = this.generateSignedFacebookClaim(username, userAddress, publicKey)
        })
        break
      default:
    }
  }

  public checkFacebookProof = async () => {
    if (typeof this.facebookClaim === 'undefined') {
      return
    }

    const text = getFacebookClaim(this.facebookClaim)
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
      signedClaim: this.facebookClaim,
      proofURL: `https://www.facebook.com/${this.facebookUserID}/posts/${postID}`,
      username: this.username,
    }

    this.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.FACEBOOK, bindingSocial)
    alert('Congratulations! the claim is verified!')
  }

  public checkTwitterProof = async () => {
    const claim: IsignedTwitterClaim = this.twitterClaim!

    const {
      twitterResource
    } = this.store
    if (typeof twitterResource === 'undefined') {
      // todo deal with could not get twitter resource
      return
    }

    const tweets = await twitterResource.getUserTimeline(this.username)

    const _claimText = getTwitterClaim(claim)
    let claimTweet: Itweet|undefined
    for (let tweet of tweets) {
      if (tweet.full_text === _claimText) {
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
      signedClaim: claim,
      proofURL: `https://twitter.com/statuses/${claimTweet.id_str}`,
      username: this.username,
    }
    this.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.TWITTER, bindingSocial)
    alert('Congratulations! the claim is verified!')
  }

  public checkGithubProof = async () => {
    const gists = await GithubResource.getGists(this.username)

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

    if (JSON.stringify(this.githubClaim) === JSON.stringify(signedClaim)) {
      const bindingSocial: IbindingSocial = {
        status: BINDING_SOCIAL_STATUS.CHECKED,
        signedClaim: signedClaim,
        proofURL: proofURL,
        username: signedClaim.claim.service.username
      }
      this.store.addBindingSocial(SOCIAL_MEDIA_PLATFORMS.GITHUB, bindingSocial)
      alert('Congratulations! the claim is verified!')
    } else {
      alert('the claim is not match')
    }
  }

  public uploadBindingProof = async () => {
    this.store.uploadBindingSocials({
      transactionDidCreate: () => {
        storeLogger.log('created')
      },
      sendingDidComplete: () => {
        storeLogger.log('completed')
        runInAction(() => {
          this.isFinished = true
        })
      }
    })
  }

  public facebookResponseCB = (response: any) => {
    this.facebookAccessToken = response.accessToken
    this.facebookUserID = response.userID
    this.updateUsername(response.name)

    storeLogger.info('Facebook AccessToken:' + this.facebookAccessToken)
    storeLogger.info('Facebook UserID:' + this.facebookUserID)

    this.continueHandler()
  }

  @action public updateUsername = (username: string) => {
    this.username = username
  }

  private generateSignedGithubClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: IgithubClaim = {
      userAddress,
      service: {
        name: SOCIAL_MEDIA_PLATFORMS.GITHUB,
        username,
      },
      ctime: Math.floor(Date.now() / 1000),
      publicKey,
    }
    const signature = '0x' + this.store.currentUserSign(JSON.stringify(claim))
    return {
      claim,
      signature,
    } as IsignedGithubClaim
  }

  private generateSignedTwitterClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: ItwitterClaim = {
      userAddress,
      publicKey,
    }
    const signature = '0x' + this.store.currentUserSign(JSON.stringify(claim))
    return {
      claim: claim,
      signature,
    } as IsignedTwitterClaim
  }

  private generateSignedFacebookClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: IfacebookClaim = {
      userAddress,
      publicKey,
    }
    const signature = '0x' + this.store.currentUserSign(JSON.stringify(claim))
    return {
      claim,
      signature,
    } as IsignedFacebookClaim
  }
}

export function getFacebookClaim(signedClaim: IsignedFacebookClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}

export function getTwitterClaim(signedClaim: IsignedTwitterClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}

export function getGithubClaim(signedClaim: IsignedGithubClaim) {
  const {
    claim: claim,
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
