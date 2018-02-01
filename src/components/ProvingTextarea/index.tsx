import * as React from 'react'

interface IProps {
  value: string
}

class ProvingTextarea extends React.Component<IProps> {
  private element: any

  public render() {
    return <textarea
      cols={80}
      rows={15}
      onClick={this.focusClaimTextarea}
      ref={(textarea) => { this.element = textarea }}
      value={this.props.value}
      readOnly={true}
    />
  }

  private focusClaimTextarea = () => {
    this.element.focus()
    this.element.select()
  }
}

export default ProvingTextarea
