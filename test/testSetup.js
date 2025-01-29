const { ethers, upgrades } = require("hardhat");

const ONE_DAY_SECONDS = BigInt(24 * 60 * 60);

async function deployVotingPowerTypeAFixture() {

  // Get the ContractFactory and Signers here.
  const GovernanceToken = await ethers.getContractFactory("Token");
  const VotingPower = await ethers.getContractFactory("VotingPowerTypeAV1Harness");

  const [
    owner,
    alice,
    bob,
    carl
  ] = await ethers.getSigners();

  const GOV_TOKEN_UNITS = 18; // @notice: Update if needed.
  const GovernanceTokenContract = await GovernanceToken.deploy(
    "GovernanceToken",
    "GT",
    GOV_TOKEN_UNITS
  );
  await GovernanceTokenContract.waitForDeployment();

  const VotingPowerContract = await upgrades.deployProxy(
    VotingPower,
    [ GovernanceTokenContract.target ],
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
    alice,
    bob,
    carl
  };
}

async function deployVotingPowerTypeBFixture() {

  // Get the ContractFactory and Signers here.
  const GovernanceToken = await ethers.getContractFactory("Token");
  const VotingPower = await ethers.getContractFactory("VotingPowerTypeBV1Harness");

  const [
    owner,
    alice,
    bob,
    carl
  ] = await ethers.getSigners();

  const GOV_TOKEN_UNITS = 6; // @notice: Update if needed.
  const GovernanceTokenContract = await GovernanceToken.deploy(
    "GovernanceToken",
    "GT",
    GOV_TOKEN_UNITS
  );
  await GovernanceTokenContract.waitForDeployment();

  const VotingPowerContract = await upgrades.deployProxy(
    VotingPower,
    [ GovernanceTokenContract.target ],
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
    alice,
    bob,
    carl
  };
}

module.exports = {
  ONE_DAY_SECONDS,
  deployVotingPowerTypeAFixture,
  deployVotingPowerTypeBFixture,
};