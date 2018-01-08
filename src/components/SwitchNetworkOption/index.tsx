import * as React from 'react'

import {
  NETWORKS,
  NETWORK_NAMES
} from '../../constants'

interface Iprops {
  networkId: NETWORKS
  onSelect: (networkId: NETWORKS) => void
}

interface Istate {
  showNetworks: boolean
}
class SwitchNetworkOption extends React.Component<Iprops, Istate> {
  public render() {
    const {
      networkId
    } = this.props

    return (
      <a onClick={this.handleClick}>
        {NETWORK_NAMES[networkId] || `Custom(${networkId})`}
      </a>
    )
  }
  private handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    const {
      networkId,
      onSelect
    } = this.props
    onSelect(networkId)
  }
}

export default SwitchNetworkOption
