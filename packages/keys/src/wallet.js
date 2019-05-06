const assert = require('chai').assert

const { Map } = require('immutable')
const { getNetwork, getConfig, Logger, toJS, fromJS } = require('demo-utils')
const LOGGER = new Logger('wallet')

const BN = require('bn.js')
const randombytes = require('randombytes')
const SignerProvider 
              = require('ethjs-provider-signer')
const ethsign = require('ethjs-signer').sign
const Eth     = require('ethjs')
const { create, createFromAddress, createFromPrivateKey, isAccount,
        encryptedJSONToAccount, accountToEncryptedJSON }
              = require('./keys')
const { toWei, fromWei } = require('web3-utils')
const { isValidAddress, isValidPrivate }
              = require('ethereumjs-utils')
const { createInOut } = require('demo-client')
const { awaitInputter, awaitOutputter } = require('demo-contract')

const OVERAGE = toWei('0.00075', 'ether')

const wallet = {}

/**
 * Create a signer provider given the current URL and account.
 * TODO: change democracy API to return the endpoint url from a config name
 * @param url {String} the URL of an endpoint
 * @param address {String} `0x`-prefixed Ethereum address of sender
 */
wallet.createSignerEth = ({url, address}) => {
    assert( isValidAddress(address), `Invalid Ethereum address ${address}` )
    const provider = new SignerProvider(url, {
      signTransaction: (rawTx, cb) => {
        let account = wallet.accountsMap[address]
        if ( isAccount(account) ) {
          cb(null, ethsign(rawTx, account.get('privatePrefixed') ) )
        } else {
          throw new Error(`Account ${address} is locked. Call wallet.unlockEncryptedAccount`)
        }
      },
      accounts: (cb) => cb(null, [address]),
    })
    wallet.signersMap[address] = new Eth(provider)
    return wallet.signersMap[address]
  }

wallet.initialized = false
wallet.inputter = null
wallet.outputter = null
wallet.accountsMap = {}
wallet.signersMap = {}
wallet.eth = getNetwork()

wallet.UNLOCK_TIMEOUT_SECONDS = 600
wallet.unlock_seconds

wallet.init = async ({autoConfig, unlockSeconds}) => {
  if (wallet.initialized) { LOGGER.error("Wallet already initialized.") }
  if (!require('keythereum')) {
    LOGGER.error("Missing keythereum, did you add a script tag?")
  }
  const inout = await createInOut({autoConfig: autoConfig})
  wallet.inputter = inout.inputter
  wallet.outputter = inout.outputter
  wallet.unlockSeconds = (unlockSeconds) ? unlockSeconds : wallet.UNLOCK_TIMEOUT_SECONDS
  wallet.chainId = await wallet.eth.net_version()
  wallet.initialized = true
}

wallet.createEncryptedAccount = async () => {
  const account = create()
  const address = account.get('addressPrefixed')
  const password = randombytes(32).toString('hex')
  const encryptedAccount = accountToEncryptedJSON(account, password)
  await wallet.saveEncryptedAccount( address, encryptedAccount )
  return {
    address: address,
    password: password,
  }
} 

wallet.loadEncryptedAccount = async (address, password) => {
  if (!wallet.initialized) { LOGGER.error("Call wallet.init() first.") }
  return awaitInputter(
    wallet.inputter(`keys/${wallet.chainId}/${address}`, null),
    (encryptedAccount) => {
      if (!encryptedAccount) { throw new Error(`Account not found for ${address}`) }
      const account = encryptedJSONToAccount( toJS(encryptedAccount), password )
      assert( isAccount(account), `Invalid account retrieved ${account}` )
      const _address = account.get('addressPrefixed')
      assert.equal( _address, address,
                   `Recovered address ${_address} doesn't match ${address}`)
      wallet.accountsMap[address] = encryptedAccount
      return encryptedAccount
    }
  )
}

wallet.saveEncryptedAccount = async ( address, encryptedAccount ) => {
  if (!wallet.initialized) { LOGGER.error("Call wallet.init() first.") }
  if (wallet.accountsMap[address]) {
    throw new Error(`Attempting to overwrite existing account at ${address}`)
  }
  wallet.accountsMap[address] = encryptedAccount
  return awaitOutputter(
    wallet.outputter( `keys/${wallet.chainId}/${address}`, fromJS(encryptedAccount) ),
    (output) => { return output }
  )
}

wallet.unlockEncryptedAccount = async ( address, password ) => {
  const encryptedAccount = wallet.accountsMap[address]
  if ( isAccount(encryptedAccount) ) {
    throw new Error(`Account ${address} already unlocked`)
  }
  wallet.accountsMap[address] = encryptedJSONToAccount( toJS(encryptedAccount), password )
  LOGGER.debug('Unlocked', address, isAccount(wallet.accountsMap[address]))
  const relockFunc = () => { wallet.accountsMap[address] = encryptedAccount } 
  setTimeout(relockFunc, wallet.unlockSeconds * 1000)
  return relockFunc
}

wallet.pay = async ({payAll, weiValue, fromAddress, toAddress, overage}) => {
  const signer = wallet.signersMap[fromAddress]
  if (!signer) { throw new Error(`No signer created for address ${fromAddress}`) }
  return wallet.payTest({eth: signer, fromAddress: fromAddress, payAll: payAll, toAddress: toAddress, weiValue: weiValue, overage: overage}) 
}

/**
 * Pay from a test account (that is already unlocked on the Ethereum node)
 * @param weiValue {String} representing the value in wei
 * @param fromAddress {String} Ethereum address of payer/sender
 * @param toAddress {String} Ethereum address of recipient
 */
wallet.payTest = async ({eth, weiValue, fromAddress, toAddress, payAll, overage}) => {
  const gasLimit = getConfig()['GAS_LIMIT']
  if (payAll) {
    LOGGER.debug('OVERAGE', fromWei(overage, 'ether'))
    const balance = await wallet.eth.getBalance(fromAddress)
    LOGGER.debug(`payAll for balance of ${fromWei(balance, 'ether')}`)
    const gasEstimate = await wallet.eth.estimateGas({
      from: fromAddress, to: toAddress, value: balance, data: '0x'})
    //LOGGER.debug(`Gas estimate for payAll is ${gasEstimate}`)
    const gasPrice = getConfig()['GAS_PRICE']
    //LOGGER.debug(`Gas price is ${gasPrice} Gwei`)
    const gasAmount = new BN(gasEstimate).mul(new BN(gasPrice)).mul(new BN(toWei('10', 'gwei')))
    //LOGGER.debug(`Gas amount is ${gasAmount}`)
    weiValue = new BN(balance).sub(new BN(overage)).toString(10)
    LOGGER.debug(`Sendable wei value is ${fromWei(weiValue, 'ether')} ETH`)
  }
  const _eth = (eth) ? eth : wallet.eth
  LOGGER.debug(`Sending wei value is ${fromWei(weiValue, 'ether')} ETH`)
  return _eth.sendTransaction({
    value: weiValue,
    data : "0x",
    from : fromAddress,
    to   : toAddress,
    gas  : gasLimit,
    nonce: await wallet.eth.getTransactionCount(fromAddress),
  })
}

module.exports = wallet
