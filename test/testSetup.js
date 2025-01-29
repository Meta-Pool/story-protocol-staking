const { ethers, upgrades } = require("hardhat");

const ONE_DAY_SECONDS = BigInt(24 * 60 * 60);

async function deployStoryPoolFixture() {

  // Get the ContractFactory and Signers here.
  const WIP = await ethers.getContractFactory("WIP");
  const RewardsManager = await ethers.getContractFactory("RewardsManager");
  const StakedIP = await ethers.getContractFactory("StakedIP");
  const StakedIPVaultOperations = await ethers.getContractFactory("StakedIPVaultOperations");
  const Withdrawal = await ethers.getContractFactory("Withdrawal");

  const [
    owner,
    operator,
    alice,
    bob,
    carl
  ] = await ethers.getSigners();

  const WIPContract = await WIP.deploy();
  await WIPContract.waitForDeployment();

  const VotingPowerContract = await upgrades.deployProxy(
    VotingPower,
    [ 
      // address _ipTokenStaking,
      WIPContract.target,
      // IStakedIPVaultOperations _operations,
      // IERC20 _asset,
      // string memory _stIPName,
      // string memory _stIPSymbol,
      // uint _minDepositAmount,
      // address _operator,
      // address _owner
    ],
    {
      initializer: "initializeHarness",
      unsafeAllow: ["constructor"]
    }
  );
  await VotingPowerContract.waitForDeployment();

  await GovernanceTokenContract.allocateTo(owner.address, ethers.parseUnits("10", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.allocateTo(alice.address, ethers.parseUnits("10", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.allocateTo(bob.address, ethers.parseUnits("7", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.allocateTo(carl.address, ethers.parseUnits("9", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.connect(alice).approve(VotingPowerContract.target, ethers.parseUnits("10", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.connect(bob).approve(VotingPowerContract.target, ethers.parseUnits("7", GOV_TOKEN_UNITS));
  await GovernanceTokenContract.connect(carl).approve(VotingPowerContract.target, ethers.parseUnits("9", GOV_TOKEN_UNITS));

  const MIN_LOCKING_DAYS = await VotingPowerContract.test_MIN_LOCKING_DAYS();
  const MAX_LOCKING_DAYS = await VotingPowerContract.test_MAX_LOCKING_DAYS();

  return {
    VotingPowerContract,
    GovernanceTokenContract,
    GOV_TOKEN_UNITS,
    MIN_LOCKING_DAYS,
    MAX_LOCKING_DAYS,
    owner,
    operator,
    alice,
    bob,
    carl
  };
}

module.exports = {
  ONE_DAY_SECONDS,
  deployStoryPoolFixture,
};