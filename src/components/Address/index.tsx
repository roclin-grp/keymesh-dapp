import * as React from 'react'

import './index.css'
import { IExtendableClassNamesProps, getBEMClassNamesMaker } from '../../utils/classNames'

interface IProps extends IExtendableClassNamesProps {
  length?: number
  address: string
}

function Address({length = 17, address, className, prefixClass}: IProps) {
  const addressText = address.slice(0, length) + '...'
  const getBEMClassNames = getBEMClassNamesMaker('address', {className, prefixClass})

  return <span className={getBEMClassNames()} title={address}>{addressText}</span>
}

export default Address
