#!/bin/bash -x

# Adapted from https://github.com/Kunstmaan/docker-ethereum/blob/master/geth-testnet/testnet.sh
# Generate and store a new account and password for mining transactions
# These can be used / donated to a faucet later.

GETH="geth"

if [ ! -z "$1" ]
then
  # We only need to init geth with custom parameters like light mode or custom genesis block.
  $GETH --light init
fi

echo $1

if [ ! -f ~/.accountpassword ]; then
    echo `date +%s | sha256sum | base64 | head -c 32` > ~/.accountpassword
fi

if [ ! -f ~/.primaryaccount ]; then
    $GETH --password ~/.accountpassword account new > ~/.primaryaccount
fi

if [ ! -f ~/.nodeidentity ]; then
    echo $(date +%s | sha256sum | head -c 8) > ~/.nodeidentity
fi

