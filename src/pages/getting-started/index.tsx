import * as React from 'react'

import { observer, inject } from 'mobx-react'
import { IStores } from '../../stores'
import { UsersStore } from '../../stores/UsersStore'
import { UserStore } from '../../stores/UserStore'

import { Link } from 'react-router-dom'
import { List, Button, Avatar } from 'antd'

import composeClass from 'classnames'
import * as classes from './index.css'

import ninjaIcon from './ninja.svg'
import givingLovePic from './giving-love.svg'
import { QUESTS, iterableQuests } from '../../stores/UserStore/GettingStartedQuests'

@inject(mapStoreToProps)
@observer
class GettingStarted extends React.Component<IProps, IState> {
  public render() {
    // TODO: generate invite link
    // const inviteLink = 'https://beta.keymesh.io/invite?t=EjQoqiP'
    const { currentUserStore } = this.props.usersStore
    if (currentUserStore == null) {
      return 'Error: should not render this page'
    }

    return (
      <main className="page-container">
        <section className={composeClass(classes.quests, 'block')}>
          <img className={classes.ninjaIcon} src={ninjaIcon} />
          <h2 className="title">
            How to Become a Crypto Ninja
          </h2>
          <p className="description">
            Welcome to the KeyMesh community, here are a few quests to help you get started
          </p>
          <List
            itemLayout="horizontal"
            dataSource={iterableQuests}
            renderItem={(quest: number) => this.renderQuestItem(quest, currentUserStore)}
          />
        </section>
        <section className={composeClass(classes.rewardPrompt, 'block', 'prompt')}>
          <h2 className="title">
            Earn 1000 KeyMesh Tokens (Early Community Reward)
          </h2>
          <img className={classes.givingLovePic} src={givingLovePic} />
          <p>
            Complete the Getting Started Quests, and we will credit your account with 1000 tokens.
          </p>
          {/* <p>
            For each friend you invite, who also complete the quests, we will credit you with an additional 200 tokens.
          </p>
          <p>
            Send your friends this invitation link: <a>{inviteLink}</a>
          </p> */}
        </section>
      </main>
    )
  }

  private renderQuestItem(quest: number, currentUserStore: UserStore) {
    const data = questsData[quest]
    const isDone = currentUserStore.gettingStartedQuests.questStatues[quest]
    return (
      <List.Item
        className={classes.questItem}
        actions={[
          <Button disabled={isDone} type="primary">
            {isDone
              ? 'Complete'
              : <Link to={data.buttonLink}>{data.buttonContent}</Link>
            }
          </Button>,
        ]}>
        <List.Item.Meta
          avatar={
            <Avatar
              className={composeClass(classes.checkStatusIcon, { [classes.unFinished]: !isDone })}
              icon="check-square"
              shape="square"
            />
          }
          title={data.title}
          description={data.description}
        />
      </List.Item>
    )
  }
}

function mapStoreToProps(stores: IStores) {
  const { usersStore } = stores

  return {
    usersStore,
  }
}

const questsData: { [questID: number]: IQuestData } = Object.freeze({
  [QUESTS.REGISTER]: {
    title: 'Publish your cryptographic identity',
    description: 'Publish your public key to the blockchain, so others can send you encrypted messages',
    buttonContent: 'Sign Up',
    buttonLink: '/register',
  },
  [QUESTS.FIRST_BROADCAST]: {
    title: 'Post a public broadcast',
    description: 'Post a message on the blockchain for all eternity. Your message is signed, and others can verify',
    buttonContent: 'Post Broadcast',
    buttonLink: '/broadcast',
  },
  [QUESTS.FIRST_MESSAGE]: {
    title: 'Send a secret message to start a conversation',
    description: 'You messages are untraceable. A spy can’t tell who you are talking to by looking at the metadata',
    buttonContent: 'Send Message',
    buttonLink: '/messages',
  },
  [QUESTS.CONNECT_TWITTER]: {
    title: 'Connect to your Twitter identity',
    description: 'Your account is more trustworthy to people if it’s connected to a living, breathing identity',
    buttonContent: 'Connect',
    buttonLink: '/proving/twitter',
  },
})

interface IQuestData {
  title: string
  buttonContent: string
  buttonLink: string
  description: string
}

interface IProps {
  usersStore: UsersStore
}
interface IState { }

export default GettingStarted
