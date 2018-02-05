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
    <>
      <Icon type="loading" className={styles.iconLoading} />
      <p>{message}</p>
    </>
  )
}

interface IProps {
  message: string
}
