import * as React from 'react'
import * as classes from './AccountInfoForm.css'

import { Input } from 'antd'
import StatusButton from '../../components/StatusButton'
import { ETHEREUM_NETWORKS } from '../../stores/MetaMaskStore'
import { getAWSAPIs, IAccountInfo } from '../../aws/AWSAPIs'
import { getRef } from '../../recordRef'

class EmailForm extends React.Component<IProps, IState> {
  public readonly state = defaultState
  public render() {
    return (
      <div className={classes.container}>
       <p>
         <label>Name</label>
         <Input
            placeholder="Please enter your name"
            value={this.state.name}
            onChange={this.handleNameChange}
         />
        </p>
        <p>
          <label>Email</label>
          <Input
            placeholder="Please enter your email"
            type="email"
            value={this.state.email}
            onChange={this.handleEmailChange}
          />
        </p>
        <StatusButton
          className={classes.saveBtn}
          onClick={this.handleSaveAccountInfo}
          disabled={!this.canSubmit()}
        >
          Save Account Info
        </StatusButton>
      </div>
    )
  }

  private handleSaveAccountInfo = async () => {
    const { userAddress, networkID, onEmailSubmitted } = this.props
    const {email, name} = this.state

    const msg = `I am ${name} and my Email is ${email}`
    const ref = getRef()
    try {
      const sig = await this.props.signMessage(msg)

      const accountInfo: IAccountInfo = { userAddress, name, email, msg, sig, ref }
      const response = await getAWSAPIs(networkID).uploadAccountInfo(accountInfo)
      if (response.status !== 201) {
        throw new Error('http status code is not 201')
      }
      onEmailSubmitted()
    } catch (e) {
      if (e.message.includes('User denied message signature')) {
        return
      }
      console.error(e)
      alert('save account info error')
    }
  }

  private canSubmit = (): boolean => {
    const {name, email} = this.state
    if (name.length < 3) {
      return false
    }
    if (!email || !validateEmail(email)) {
      return false
    }

    return true
  }

  private handleNameChange = (event: any) => {
    this.setState({ name: event.target.value.trim() })
  }

  private handleEmailChange = (event: any) => {
    this.setState({ email: event.target.value.trim() })
  }
}

export default EmailForm

interface IProps {
  signMessage: (message: string) => Promise<string>
  networkID: ETHEREUM_NETWORKS
  userAddress: string
  onEmailSubmitted: () => void
}

interface IState {
    name: string
    email: string
}

const defaultState: Readonly<IState> = {
    name: '',
    email: '',
}

const emailRegExp = new RegExp('^[^\\.\\s@:][^\\s@:]*(?!\\.)@[^\\.\\s@]+(?:\\.[^\\.\\s@]+)*$')

function validateEmail(email: string) {
  return emailRegExp.test(email.toLocaleLowerCase())
}
