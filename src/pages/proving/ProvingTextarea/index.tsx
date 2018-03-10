import * as React from 'react'

import * as classes from './index.css'
import classnames from 'classnames'

import copy from 'copy-to-clipboard'

class ProvingTextarea extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    isCopied: false,
  }

  public render() {
    const {
      value,
      className,
    } = this.props
    return (
      <div className={classes.container} >
      <textarea
        disabled={true}
        className={className}
        cols={120}
        rows={8}
        value={value}
        readOnly={true}
      />
      {this.renderCopyButton()}
      </div>
    )
  }

  private renderCopyButton() {
    if (this.state.isCopied) {
      return (
        <span onMouseLeave={this.handleMouseLeave} className={classnames(classes.copyButton, classes.copied)}>
          Copied!
        </span>
      )
    }

    return (
      <a onClick={this.handleCopy} className={classes.copyButton}>
        Copy
      </a>
    )
  }

  private handleMouseLeave = () => {
    this.setState({ isCopied: false })
  }

  private handleCopy = () => {
    const { value } = this.props
    if (copy(value)) {
      this.setState({ isCopied: true })
    }
  }
}

interface IProps {
  value: string
  className?: string
}

interface IState {
  isCopied: boolean
}

export default ProvingTextarea
