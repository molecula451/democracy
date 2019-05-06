'use strict'
// Environment-controlled configuration to choose network and deploy parameters

require('dotenv').config()
const { Logger } = require('./logger')
// Pass in log-levels explicitly because this LOGGER cannot include itself
const assert = require('chai').assert

const { Map } = require('immutable')

const configs = {}

configs.setEnvVars = (_env) => {
  new Map(_env).forEach((val,key) => { process.env[key] = val })
}

// TODO: corresponds to eth.arcology.nyc but our Whisper node is not accepting
// packets addresses to this hostname for some reason.
//const SHH_IP = "ws://54.69.190.230:8546"
const SHH_IP = "ws://eth.arcology.nyc:8546"
const createEnv = ({ ethURL, dbURL, shhURL, gl, gp, db, lo, ll }) => {
  if (!lo) {
    console.error('Create a `.env` file with at least  ${NODE_ENV}.LOG_OUT defined.')
  }
  return {
    'DB_URL'      : dbURL,
    'ETH_URL'     : ethURL,
    'SHH_URL'     : shhURL,
    'DB_NAMESPACE': db,
    'GAS_PRICE'   : gp,
    'GAS_LIMIT'   : gl,
    'LOG_OUT'     : lo,
    'LOG_LEVELS'  : ll,
  }
}

const checkEnv = (config, vars) => {
  vars.forEach((v) => {
    if (!process.env[v]) {
      LOGGER.errorAndThrow(`Environment variable ${v} needed but not defined.`)
    }
  })
  return config
}

configs.parseLogLevels = (string) => {
  return (string) ? string.split(',').map((l) => l.toLowerCase() ) : string
}

const createDevEnv = () => {
  return createEnv({
    'dbURL' : process.env[ 'DEVELOPMENT.DB_URL'  ] || 'http://localhost:7000',
    'ethURL': process.env[ 'DEVELOPMENT.ETH_URL' ] || 'http://localhost:8545',
    'shhURL': process.env[ 'DEVELOPMENT.SHH_URL' ] || 'ws://localhost:8546',
    'gp'    : 5,
    'gl'    : '670000',
    'db'    : 'dev',
    'lo'    : process.env[ 'DEVELOPMENT.LOG_OUT' ],
    'll'    : configs.parseLogLevels(process.env[ 'DEVELOPMENT.LOG_LEVELS' ]) ||
              [ 'info', 'warn', 'error' ],
  })
}
	
const ENVIRONMENTS = {
  'DEVELOPMENT': createDevEnv,
  'DEV'        : createDevEnv,
  'TEST'       : () => {
    return createEnv({
    'dbURL'  : process.env[ 'TEST.DB_URL'  ] || 'http://ganache.arcology.nyc:7000',
    'ethURL' : process.env[ 'TEST.ETH_URL' ] || 'http://ganache.arcology.nyc:8545',
    'shhURL' : process.env[ 'TEST.SHH_URL' ] || SHH_IP,
    'gp'     : 5,
    'gl'     : '670000',
    'db'     : 'test',
    'lo'     : process.env[ 'TEST.LOG_OUT' ],
    'll'     : configs.parseLogLevels(process.env[ 'TEST.LOG_LEVELS' ]) ||
               [ 'info', 'warn', 'error' ],
  }) },
  'RINKEBY'    : () => { return checkEnv(createEnv({
    'dbURL'  : process.env[ 'RINKEBY.DB_URL'  ] || 'http://ganache.arcology.nyc:8545',
    'ethURL' : process.env[ 'RINKEBY.ETH_URL' ] || `https://rinkeby.infura.io/${process.env.INFURA_PROJECT_ID}`,
    'shhURL' : process.env[ 'RINKEBY.SHH_URL' ] || SHH_IP,
    'gp'     : 5,
    'gl'     : '670000',
    'db'     : 'rinkeby',
    'lo'     : process.env[ 'RINKEBY.LOG_OUT' ],
    'll'     : configs.parseLogLevels(process.env[ 'RINKEBY.LOG_LEVELS' ]) ||
               [ 'warn', 'error' ],
  }), ['INFURA_PROJECT_ID']) },
  'MAINNET'    : () => { return checkEnv(createEnv({
    'dbURL'  : process.env[ 'MAINNET.DB_URL'  ] || 'http://ganache.arcology.nyc:8545',
    'ethURL' : process.env[ 'MAINNET.ETH_URL' ] || `https://mainnet.infura.io/${process.env.INFURA_PROJECT_ID}`,
    'shhURL' : process.env[ 'MAINNET.SHH_URL' ] || SHH_IP,
    'gp'     : 5,
    'gl'     : '670000',
    'db'     : 'mainnet',
    'lo'     : process.env[ 'MAINNET.LOG_OUT' ],
    'll'     : configs.parseLogLevels(process.env[ 'MAINNET.LOG_LEVELS' ]) ||
               [ 'warn', 'error' ],
  }), ['INFURA_PROJECT_ID']) },
}

configs.isNetName = (_name) => {
  assert(_name, 'Net name cannot be empty.')
  return (ENVIRONMENTS[_name.toUpperCase()] !== undefined)
}

const lazyEval = (env) => {
  let config = ENVIRONMENTS[env]
  if (typeof(config) === 'function') {
    ENVIRONMENTS[env] = config()
    config = ENVIRONMENTS[env]
  }
  return config
}

configs.getConfig = (debugPrint) => {
  const windowEnv = (typeof window != 'undefined' && window.document) ? window.NODE_ENV : ""
  const processEnv = process.env.NODE_ENV ? process.env.NODE_ENV.toUpperCase() : ""
  const env = windowEnv ? windowEnv : processEnv
  debugPrint && LOGGER.debug(`NODE_ENV=${env}`)
  let config = lazyEval(env)
  if (config) {
   return config
  } else {
   debugPrint && LOGGER.debug('NODE_ENV not defined, using TEST')
   return lazyEval('TEST')
  }
}

const LOGGER = new Logger('config', [ 'warn', 'error' ], configs.getConfig)

module.exports = configs
