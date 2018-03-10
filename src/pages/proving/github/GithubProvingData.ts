import { action } from 'mobx'

import ProvingData from '../ProvingData'

import { GithubResource, IGist } from '../../../resources/github'
import {
  PLATFORMS,
  GITHUB_GIST_FILENAME,
} from '../../../stores/SocialProofsStore'

export class GithubProvingData extends ProvingData {
  public get platform() {
    return PLATFORMS.GITHUB
  }
  protected findProofHelpText = `Make sure your gist is public accessible and contains file ${GITHUB_GIST_FILENAME}`

  @action
  protected init() {
    this.steps = [
      'Enter username',
      'Create a gist',
      'Record Proof',
      'Done',
    ]
  }

  protected async getProofURL(claimText: string): Promise<string | null> {
    const gists = await GithubResource.getGists(this.username)
    return getClaimGistURL(gists, claimText)
  }
}

async function getClaimGistURL(gists: IGist[], claimText: string): Promise<string | null> {
  const claimGistURLAndClaimTextURL = getClaimGistURLAndClaimTextRawURL(gists)
  if (claimGistURLAndClaimTextURL === null) {
    return null
  }

  const {
    gistURL,
    claimTextRawURL,
  } = claimGistURLAndClaimTextURL
  const gistClaimText = await GithubResource.getGistRawContent(claimTextRawURL)
  if (gistClaimText !== claimText) {
    return null
  }

  return gistURL
}

function getClaimGistURLAndClaimTextRawURL(gists: IGist[]): { gistURL: string; claimTextRawURL: string } | null {
  for (const gist of gists) {
    if (Object.keys(gist.files).includes(GITHUB_GIST_FILENAME)) {
      const gistURL = gist.html_url
      const claimTextRawURL = gist.files[GITHUB_GIST_FILENAME].raw_url
      return {
        gistURL,
        claimTextRawURL,
      }
    }
  }
  return null
}
