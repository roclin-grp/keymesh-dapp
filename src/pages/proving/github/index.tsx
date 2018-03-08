import * as React from 'react'
import { observer } from 'mobx-react'

import { GithubProvingData } from './GithubProvingData'
import ProvingTextarea from '../ProvingTextarea'
import StatusButton from '../../../components/StatusButton'

import { GITHUB_GIST_FILENAME, signedClaimToClaimText } from '../../../stores/SocialProofsStore'
import { PROVING_STEPS } from '../ProvingData'

import { Icon, Button, Input, Divider } from 'antd'
import * as classes from './index.css'
import * as commonClasses from '../index.css'

interface IProps {
  data: GithubProvingData
}

@observer
class GithubProving extends React.Component<IProps> {
  public render() {
    const { data } = this.props
    const { username, currentStep } = data

    if (currentStep === PROVING_STEPS.CONNECT) {
      return (
        <>
          <div className={classes.usernameContainer}>
            <Icon type={data.platform} className={classes.platformIcon} />
            <Input
              spellCheck={false}
              value={username}
              onChange={(e: any) => data.updateUsername(e.target.value)}
              placeholder={`Your Github username`}
              onPressEnter={data.continueHandler.bind(data)}
            />
          </div>
          <div>
            <Button size="large" type="primary" onClick={data.continueHandler.bind(data)}>
              Continue
            </Button>
          </div>
        </>
      )
    }

    const {
      proofStatusType,
      proofStatusContent,
      buttonDisabled,
    } = data

    if (currentStep === PROVING_STEPS.POST) {
      return (
        <>
          <h3>
            Proving yourself as @${username}
          </h3>
          <p>
            Login to GitHub and paste the text below into a public gist file called
            <span className={classes.filename}> {GITHUB_GIST_FILENAME}</span>
            .
          </p>
          <ProvingTextarea value={signedClaimToClaimText(data.claim!)} />
          <Button size="large" className={commonClasses.postButton} type="primary">
            <a href="https://gist.github.com/" target="_blank">Create gist</a>
          </Button>
          <Divider />
          <h3>
            Check the proof after you have created the gist
          </h3>
          <StatusButton
            disabled={buttonDisabled}
            statusType={proofStatusType}
            statusContent={proofStatusContent}
            onClick={data.checkProof.bind(data)}
          >
            Check Proof
          </StatusButton>
        </>
      )
    }

    const proof = data.proof!
    const { proofURL } = proof

    if (currentStep === PROVING_STEPS.RECORD) {
      return (
        <>
          <h3>
            Proving yourself as @{username}, and your proof is published
          </h3>
          <p>
            The proof URL is
            <a target="_blank" href={proofURL}>
             {` ${proofURL}`}
            </a>
          </p>
          <Divider />
          <h3>
            Record the proof URL on the blockchain so everyone can find it
          </h3>
          <StatusButton
            disabled={buttonDisabled}
            statusType={proofStatusType}
            statusContent={proofStatusContent}
            onClick={data.uploadBindingProof.bind(data)}
          >
            Record Proof
          </StatusButton>
        </>
      )
    }

    return null
  }
}

export default GithubProving
