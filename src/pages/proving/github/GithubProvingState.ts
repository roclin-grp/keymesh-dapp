import { action } from 'mobx'

import ProvingState from '../ProvingState'

import { GithubResource, IGist } from '../../../resources/github'
import {
  PLATFORMS,
  GITHUB_GIST_FILENAME,
} from '../../../stores/BoundSocialsStore'

export class GithubProvingState extends ProvingState {
  protected defaultCheckingErrorContent =
    `Please paste the text into a public gist called ${GITHUB_GIST_FILENAME}, then check again!`

  public get platform() {
    return PLATFORMS.GITHUB
  }

  @action
  protected init() {
    this.steps = [
      'Enter username',
      'Create a gist',
      'Upload infomations',
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
