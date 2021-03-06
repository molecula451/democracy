const fs         = require('fs')
const assert     = require('chai').assert

const { keccak } = require('ethereumjs-util')
const utils      = require('demo-utils')
const { Logger, ZEPPELIN_SRC_PATH, fromJS, toJS } = utils

const { ContractsManager, isCompile, isContract, getInputsToBuild }
             = require('demo-contract')
const { Compiler, Flattener } = require('..')
const LOGGER = new Logger('Compiler Test')

describe('Democracy compiling.', () => {
  
  let compileOutput
  let _requestedInputs
  let _inputsToBuild
  let _existingOutputs
  let _findImports
  let _contracts
  const SOURCE_PATH = '../../node_modules/demo-test-contracts/contracts'
  const comp  = new Compiler({ sourcePathList: [ SOURCE_PATH ] })
  const cm = comp.getContractsManager()

  before(async () => {
    await cm.cleanAllCompiles()
  })

  it( 'compiler has correct start source path', () => {
    assert(comp.sourcePathSet.has(SOURCE_PATH),
    `Incorrect source path ${comp.sourcePathSet.toJS()}`)
  })

  it( 'gets the correct requested inputs' , (done) => {
    const { requestedInputs, findImports } =
      comp.getRequestedInputsFromDisk( 'ERC20.sol' , new Flattener() )
    assert.equal(1, requestedInputs.count())
    assert.equal('ERC20.sol', requestedInputs.get('ERC20').get('filename'))
    const safeMath = fs.readFileSync(
      '../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol').toString()
    assert.equal(findImports('SafeMath.sol').contents, safeMath)
    _requestedInputs = requestedInputs
    _findImports = findImports
    done()
  })

  it( 'gets the correct inputs to build' , async () => {
    const { contractOutputs: existingOutputs } = await cm.getContracts()
    const inputsToBuild = getInputsToBuild(_requestedInputs, existingOutputs)
    assert.equal(1, inputsToBuild.count())
    assert.equal(true, inputsToBuild.get('ERC20').get('isNew'))
    assert.equal(false, inputsToBuild.get('ERC20').get('isUpdated'))
    assert.equal('ERC20.sol', inputsToBuild.get('ERC20').get('filename'))
    _inputsToBuild = inputsToBuild
    _existingOutputs = existingOutputs
  })
  
  it( 'formats the correct sourceMap for solc' , async () => {
    const sourcesToBuild = comp.getSourceMapForSolc(_inputsToBuild)
    assert.ok(sourcesToBuild.has('ERC20.sol'), 'ERC20.sol is a filename to be built')
    const erc20 = fs.readFileSync(
      '../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol').toString()
    assert.equal(erc20, sourcesToBuild.get('ERC20.sol').content)
    const solc = require('solc')

    const inputs = {
      language: 'Solidity',
      settings: {
        outputSelection: {
          '*': {
            '*': [ '*' ]
          }
        }
      },
      sources: toJS( sourcesToBuild ),
    }

    const outputs = JSON.parse(solc.compile(JSON.stringify(inputs), _findImports))
    LOGGER.debug('OUTPUTS', outputs)
    
    assert.ok(outputs.contracts['ERC20.sol']['ERC20'])
    
    const outputMap =
      await comp.getCompileOutputFromSolc( fromJS(outputs.contracts),
                                          _requestedInputs, _existingOutputs)
    assert.ok(outputMap.get('ERC20'))
  })

  it( 'inputs have the correct members and hash', async () => {
    const inputSource = fs.readFileSync(
      '../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol')
    const inputHash = keccak(inputSource).toString('hex')
    const contract = await cm.getContract('ERC20')
    const contractJS = toJS(contract)
    const actualContentHash = contractJS['contentHash']
    delete(contractJS['contentHash'])
    delete(contractJS['dateTime'])
    delete(contractJS['timestamp'])
    const contentHash = keccak(JSON.stringify(contractJS)).toString('hex')
    assert.equal(contract.get('inputHash'), inputHash)
    LOGGER.debug('PREHASH', JSON.stringify(contractJS))
    assert.equal(JSON.stringify(contractJS),
                 JSON.stringify(contract
                                .remove('contentHash')
                                .remove('dateTime')
                                .remove('timestamp').toJS()))
    assert.equal(actualContentHash, contentHash)
  })

  it( 'finds an existing contract on disk', async () => {
    const { findImports, requestedInputs } =
      comp.getRequestedInputsFromDisk( 'TestLibrary.sol', new Flattener() )
    const source = fs.readFileSync(
      '../../node_modules/demo-test-contracts/contracts/TestLibrary.sol').toString()
    assert.equal(requestedInputs.get('TestLibrary').get('source'), source)
    assert(findImports('TestLibrary.sol'), source)
  })

  it( 'compiles all the way through the pipeline' , async () => {
    compileOutput = await comp.compile( 'TestLibrary.sol' )
    LOGGER.debug('compileOutput', compileOutput)
    assert.ok( isCompile(compileOutput) )
    const contract = await cm.getContract( 'TestLibrary' )
    assert.ok(isContract(contract), "TestLibrary should have a compile output.")
  })

  it( 'should *not* find a non-existent compiled contract' , async () => {
    const nonContract = await cm.getContract('TestLooberry')
    assert.notOk(nonContract,
                 "TestLooberry is not even a real thing, dude.")
  })
  
  it( 'should compile from OpenZeppelin paths', async () => {
    //await cm.cleanContract( 'ERC20' )
    const compile = await comp.compile('ERC20.sol' )
    assert.ok( isCompile(compile) )
    
    await cm.cleanCompile(compile)
    assert.notOk(await cm.getContract('ERC20'))
  })

  after( async() => {
    await cm.cleanAllCompiles(compileOutput)
  })

})
