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
class NetworkOption extends React.Component<Iprops, Istate> {
  public render() {
    const {
      networkId
    } = this.props
    return <li onClick={this.handleClick}>
      {(NETWORK_NAMES as any)[networkId] || `Custom(${networkId})`}
    </li>
  }
  private handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
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

export default NetworkOption
