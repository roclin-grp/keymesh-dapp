import { observable, action, computed } from 'mobx'

import { IUser } from '.'

export default class GettingStartedQuests {
  @observable.ref public questStatues: { [questID: number]: boolean } = {}

  @computed
  public get totalCompletedCount(): number {
    let result = 0
    for (const quest of iterableQuests) {
      if (this.questStatues[quest]) {
        result++
      }
    }
    return result
  }

  constructor(
    private readonly user: IUser,
  ) {
    for (const quest of iterableQuests) {
      if (quest === QUESTS.REGISTER) {
        this.setQuest(quest, true)
        continue
      }

      const isDone = getQuestStatus(quest, user)
      this.setQuest(quest, isDone)
    }
  }

  @action
  public setQuest(questID: QUESTS, isDone: boolean) {
    this.questStatues[questID] = isDone
    this.questStatues = Object.assign({}, this.questStatues)
    if (isDone) {
      setQuestCompleted(questID, this.user)
    }
  }
}

export enum QUESTS {
  REGISTER = 'register',
  FIRST_BROADCAST = 'first-broadcast',
  FIRST_MESSAGE = 'first-message',
  CONNECT_TWITTER = 'connect-twitter',
}

export const iterableQuests = Object.values(QUESTS) as QUESTS[]

function setQuestCompleted(questID: QUESTS, user: IUser) {
  localStorage.setItem(`keymesh@${user.networkId}@${user.userAddress}@quest-${questID}`, 'done')
}

function getQuestStatus(questID: QUESTS, user: IUser): boolean {
  return Boolean(localStorage.getItem(`keymesh@${user.networkId}@${user.userAddress}@quest-${questID}`))
}
