import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import * as styles from './index.css'
import classnames from 'classnames'

export default function Loading({
  message,
}: IProps) {
  return (
    <div className={classnames(styles.container, 'page-content')}>
      <Icon type="loading" className={styles.iconLoading} />
      <p>{message}</p>
    </div>
  )
}

interface IProps {
  message: string
}
