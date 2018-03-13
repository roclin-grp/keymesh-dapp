import { PromiEvent, TransactionReceipt } from 'web3/types'
import Web3 from 'web3'

import ENV from '../config'

import { sleep } from '.'

export function transactionPromiEventToPromise(promiEvent: PromiEvent<TransactionReceipt>): Promise<string> {
  return new Promise((resolve, reject) => {
    promiEvent
      .on('transactionHash', (hash) => {
        resolve(hash)
      })
      .on('error', (error: Error) => {
        if (error.message.includes('Transaction was not mined within 50 blocks')) {
          // we don't know whether the tx was confirmed or not. don't do anything.
          return
        }
        reject(error)
      })
  })
}

export function getProcessingTransactionHandlers(
  web3: Web3,
  transactionHash: string,
): IProcessingTransactionHandlers {
  let isPolling = true

  // TODO: use error code instead of message
  const getReceipt = async (options: IGetReceiptOptions = {}) => {
    const {
      requiredConfirmation = ENV.REQUIRED_CONFIRMATION_NUMBER,
      estimateAverageBlockTime = ENV.ESTIMATE_AVERAGE_BLOCK_TIME,
      timeoutBlockNumber = ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER,
      onConfirmation,
    } = options

    let lastBlockNumber: number | null = null
    let blockCounter = 0
    let isFirstConfirmation = true
    let firstConfirmedReceiptBlockNumber = 0
    while (isPolling) {
      if (blockCounter > timeoutBlockNumber) {
        throw new Error('Timeout')
      }

      const currentBlockNumber = await web3.eth.getBlockNumber()
      const receipt = await web3.eth.getTransactionReceipt(transactionHash)
      // not yet confirmed or is pending
      if (receipt == null || receipt.blockNumber == null) {
        if (!isFirstConfirmation) {
          // receipt we had fetched is from a fork chain, reset data
          firstConfirmedReceiptBlockNumber = 0
          isFirstConfirmation = true
        }

        if (lastBlockNumber != null) {
          blockCounter += currentBlockNumber - lastBlockNumber
        }
        lastBlockNumber = currentBlockNumber
        await sleep(estimateAverageBlockTime / 2)
        continue
      }

      const hasTransactionError = receipt.logs == null || receipt.logs.length === 0
      if (hasTransactionError) {
        throw new Error('Transaction process error')
      }

      const receiptBlockNumber = receipt.blockNumber
      if (isFirstConfirmation) {
        firstConfirmedReceiptBlockNumber = receiptBlockNumber
        isFirstConfirmation = false
      }

      const confirmationCounter = currentBlockNumber - firstConfirmedReceiptBlockNumber
      // wait for more confirmations
      if (confirmationCounter < requiredConfirmation) {
        if (onConfirmation != null) {
          // currentBlockNumber is possibly less than firstConfirmedReceiptBlockNumber.
          onConfirmation(confirmationCounter < 0 ? 0 : confirmationCounter)
        }

        await sleep(estimateAverageBlockTime / 2)
        continue
      }

      // enough confirmation, success
      return receipt
    }
    return
  }

  const stopGetReceipt = () => {
    isPolling = false
  }

  return {
    getReceipt,
    stopGetReceipt,
  }
}

export type TypeOnConfirmationCallback = (confirmationNumber: number) => void

export interface IGetReceiptOptions {
  requiredConfirmation?: number,
  estimateAverageBlockTime?: number,
  timeoutBlockNumber?: number,
  onConfirmation?: TypeOnConfirmationCallback,
}

export interface IProcessingTransactionHandlers {
  getReceipt(options?: IGetReceiptOptions): Promise<TransactionReceipt | undefined>,
  stopGetReceipt(): void,
}
