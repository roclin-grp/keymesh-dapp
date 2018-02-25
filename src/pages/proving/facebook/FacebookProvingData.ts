import { action } from 'mobx'

import ProvingData from '../ProvingData'
import { FacebookResource, IPost } from '../../../resources/facebook'
import { PLATFORMS } from '../../../stores/BoundSocialsStore'

export class FacebookProvingData extends ProvingData {
  public platform = PLATFORMS.FACEBOOK
  protected defaultCheckingErrorContent = `Please post the your proof to Facebook, `
    + `the content must be exactly as the screen appears and make sure that is public. `
    + `Then check again!`

  private facebookAccessToken: string | null = null
  private facebookUserID: string | null = null

  public loginCallback = (response: any) => {
    this.facebookAccessToken = response.accessToken
    this.facebookUserID = response.userID
    this.updateUsername(response.name)

    this.continueHandler()
  }

  @action
  protected init() {
    this.steps = [
      'Authroize',
      'Publish a public post',
      'Upload infomations',
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
