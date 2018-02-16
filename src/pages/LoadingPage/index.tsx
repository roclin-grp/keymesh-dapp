import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import * as styles from './index.css'

export default function Loading({
  message,
}: IProps) {
  return (
    <div className={styles.container}>
      <Icon type="loading" className={styles.iconLoading} />
      <p>{message}</p>
    </div>
  )
}

interface IProps {
  message: string
}
