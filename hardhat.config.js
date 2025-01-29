const {
  RPC_URL,
  BLOCK_NUMBER,
  MNEMONIC,
  FORKING_CHAIN_ID
} = require('./scripts/env')

require('@nomicfoundation/hardhat-toolbox')
require('@openzeppelin/hardhat-upgrades')

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      // chainId: FORKING_CHAIN_ID,
      // accounts: { mnemonic: MNEMONIC },
      // forking: {
      //   url: RPC_URL,
      //   blockNumber: BLOCK_NUMBER,
      //   enabled: true,
      // },
    },
    testnet: {
      url: RPC_URL,
      accounts: { mnemonic: MNEMONIC },
    },
    mainnet: {
      url: RPC_URL,
      accounts: { mnemonic: MNEMONIC },
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
  }
}