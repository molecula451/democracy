democracy
=========

Tools for running a country on Ethereum.

REPL
=======

To experiment with and administer Ethereum contracts, it's useful to have a central
console able to attach to any JSONRPC endpoint, whether it's on the mainnet or one
of the third-generation testnets (Ropsten, Kovan, or the upcoming Rinkeby).

Use `preamble.js` to include some boilerplate JSONRPC connection code, which
connects to a Ganache local private testnet on `localhost:8545` by default.

```
node -i -e "web3 = require('./js/preamble')('test')"
```

An example session looks like:

```
$ node -i -e "web3 = require('./js/preamble')('test').web3"
> Coinbase: 
Net: test
kovan
> web3.eth.accounts().then((value) => console.log(JSON.stringify(value))) 
[ '0x00167d7f67f0e2af7580a771d713267c4042d643',
  '0x9025d8a37da2d7c302ef3bd7a6ff65c3a5c37020',
  '0xe8e6b09c730ffd235d15fff0c3751c20d858c306' ]
> web3.eth.getBalance(web3.eth.coinbase)
{ [String: '0'] s: 1, e: 0, c: [ 0 ] }
>
```
