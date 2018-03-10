import { action } from 'mobx'

import ProvingData from '../ProvingData'
import { FacebookResource, IPost } from '../../../resources/facebook'
import { PLATFORMS } from '../../../stores/SocialProofsStore'
import { STATUS_TYPE } from '../../../components/StatusButton'

export class FacebookProvingData extends ProvingData {
  public get platform() {
    return PLATFORMS.FACEBOOK
  }
  protected findProofHelpText = 'Make sure your post is public accessible'

  private facebookAccessToken: string | null = null
  private facebookUserID: string | null = null

  public startLogin = () => {
    this.setProofStatusType(STATUS_TYPE.LOADING)
    this.setProofStatusContent('Connecting...')
  }

  public loginCallback = (response: any) => {
    if (
      response.accessToken == null ||
      response.userID == null ||
      response.name == null
    ) {
      this.setProofStatusType(STATUS_TYPE.WARN, false)
      this.setProofStatusContent('Failed to connect')
      return
    }

    this.facebookAccessToken = response.accessToken
    this.facebookUserID = response.userID
    this.updateUsername(response.name)

    this.clearProofStatusButton()
    this.continueHandler()
  }

  @action
  protected init() {
    this.steps = [
      'Connect To Facebook',
      'Post Proof',
      'Record Proof',
      'Done',
    ]
  }

  protected async getProofURL(claimText: string): Promise<string | null> {
    if (this.facebookAccessToken === null || this.facebookUserID === null) {
      return null
    }
    const posts = await FacebookResource.getPosts(this.facebookUserID, this.facebookAccessToken)
    return this.getClaimPostURL(posts, claimText)
  }

  private getClaimPostURL(posts: IPost[], claimText: string): string | null {
    const post = getClaimPost(posts, claimText)
    if (post === null) {
      return null
    }

    const parts = post.id.split('_')
    const postID = parts[1]

    return `https://www.facebook.com/${this.facebookUserID}/posts/${postID}`
  }
}

function getClaimPost(posts: IPost[], claimText: string): IPost | null {
  for (const post of posts) {
    if (!post.hasOwnProperty('message')) {
      continue
    }
    if (post.message === claimText) {
      return post
    }
  }
  return null
}
