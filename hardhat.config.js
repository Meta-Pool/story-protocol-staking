const {
  RPC_URL,
  BLOCK_NUMBER,
  MNEMONIC,
  FORKING_CHAIN_ID,
  FORK_CHAIN
} = require('./scripts/env')

require('@nomicfoundation/hardhat-toolbox')
require('@openzeppelin/hardhat-upgrades')
require("hardhat-contract-sizer");
require("./tasks/inject_rewards");

const forking = {
  url: RPC_URL,
  enabled: FORK_CHAIN,
}

if (BLOCK_NUMBER) 
  forking.blockNumber = BLOCK_NUMBER

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      chainId: FORKING_CHAIN_ID,
      accounts: { mnemonic: MNEMONIC },
      forking,
    },
    mainnet: {
      url: RPC_URL,
      accounts: [process.env.OWNER_PRIVATE_KEY]
    },
  },
  solidity: {
    version: '0.8.28',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false, // allow tests to run anyway
  },
}