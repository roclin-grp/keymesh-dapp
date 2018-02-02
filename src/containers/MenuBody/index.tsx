import * as React from 'react'

import {
  Link,
} from 'react-router-dom'

// helper
import {
  getBEMClassNamesMaker,
  IExtendableClassNamesProps,
} from '../../utils/classNames'

import './index.css'

// component
import {
  Menu,
} from 'antd'

interface IProps extends IExtendableClassNamesProps {
  routePath: string
}

export default function MenuBody({
  children,
  prefixClass,
  className,
  routePath,
}: IProps & { children?: React.ReactNode }) {
  const getBEMClassNames = getBEMClassNamesMaker('menu-body', { className, prefixClass })
  return <div className={getBEMClassNames('content')}>
    <Menu className={getBEMClassNames('menu')} selectedKeys={[routePath]}>
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
