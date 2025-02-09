const { getSupportedNetworks } = require('./utils')
require('dotenv').config()

const NETWORK = process.env.NETWORK || 'hardhat';

if (!getSupportedNetworks().includes(NETWORK) && NETWORK != 'hardhat') throw new Error(`Unsupported network: ${NETWORK}`)

module.exports = {
  NETWORK,
  FORKING_CHAIN_ID: Number(process.env.FORKING_CHAIN_ID),
  RPC_URL: process.env.RPC_URL,
  BLOCK_NUMBER: Number(process.env.BLOCK_NUMBER),
  MNEMONIC: process.env.MNEMONIC,
  FORK_CHAIN: process.env.FORK_CHAIN === 'true',
}
