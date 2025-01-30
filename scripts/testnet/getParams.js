const hre = require("hardhat");
const { ethers } = require("hardhat");

console.log("Network: %s", hre.network.name);

const STAKING_CONTRACT = "0xcccccc0000000000000000000000000000000001";

async function main() {

  const IPTokenStaking = await ethers.getContractFactory("IPTokenStaking");
  const IPTokenStakingContract = await IPTokenStaking.attach(STAKING_CONTRACT);

  console.log("minCommissionRate: ", await IPTokenStakingContract.minCommissionRate());
  console.log("minStakeAmount: ", await IPTokenStakingContract.minStakeAmount());
  console.log("minUnstakeAmount: ", await IPTokenStakingContract.minUnstakeAmount());
  console.log("fee: ", await IPTokenStakingContract.fee());
  console.log("DEFAULT_MIN_FEE: ", await IPTokenStakingContract.DEFAULT_MIN_FEE());
  console.log("MAX_DATA_LENGTH: ", await IPTokenStakingContract.MAX_DATA_LENGTH());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
