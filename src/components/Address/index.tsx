import * as React from 'react'

import * as styles from './index.css'

interface IProps {
  length?: number
  address: string
}

function Address({length = 17, address }: IProps) {
  const addressText = address.slice(0, length) + '...'
  return <span className={styles.address} title={address}>{addressText}</span>
}

export default Address
