import * as React from 'react'

import {
  Link,
} from 'react-router-dom'

import * as styles from './index.css'

// component
import {
  Menu,
} from 'antd'

interface IProps {
  routePath: string
}

export default function MenuBody({
  children,
  routePath,
}: IProps & { children?: React.ReactNode }) {
  return <div className={styles.content}>
    <Menu className={styles.menu} selectedKeys={[routePath]}>
      <Menu.Item key="/discover">
        <Link to="/discover">
          Discover
        </Link>
      </Menu.Item>
      <Menu.Item key="/chat">
        <Link to="/chat">
          Chat
        </Link>
      </Menu.Item>
    </Menu>
    {children}
  </div>
}
