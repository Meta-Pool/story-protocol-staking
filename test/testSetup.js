const { ethers, upgrades } = require("hardhat");

const ONE_DAY_SECONDS = BigInt(24 * 60 * 60);
const MLARGE = ethers.parseEther("100000000");
const GWEI = ethers.parseUnits("1", 9);

const DUMMY_VALIDATOR_SET = [
  {
    "path": "m/44'/60'/0'/0/0",
    "address": "0x0BB327db18CA49c7dE9B938eb398BaB9048E80cB",
    "publicKey": "0x02ecfae0000f4a915c18b3c48714d0d230f0b2a9c08422512c1a99008f6b7c9da0",
    "privateKey": "0x0a5750470b216a2f62e51509a1e56d1b894017436fa47c41655575f4233bd4b3"
  },
  {
    "path": "m/44'/60'/0'/0/1",
    "address": "0xEAaA08F80B6aF29933d6adD89bd80B6b575D73cd",
    "publicKey": "0x025c821e77daaabddff3f4b0d22aa9bc1b2f8d43bd9d1c71425d1b001cd3262c84",
    "privateKey": "0xdf5156952a50b1a1cfc3b21c83b608b2d37e9f81512389ae7f4fc0d76bafeaaf"
  },
  {
    "path": "m/44'/60'/0'/0/2",
    "address": "0x2B3856D9211031d7136ac0482e3A423323F1675A",
    "publicKey": "0x021d542e99c036aa55bcbc899585f30eaa0bff47bbbf2f643a4ed5044f42bbfd70",
    "privateKey": "0xeafe3bd53f136390be56fe6715d78c7710ae51cd2768fbfc3da4d1efabfc4730"
  },
  {
    "path": "m/44'/60'/0'/0/3",
    "address": "0x34b8C22Ee0d6100Af6547d6FEE77953711fae36E",
    "publicKey": "0x02a52245277652393885a3163c46660f11331677ab528c96548a9e39bdb76b6c71",
    "privateKey": "0xac99bf36a7f32506a40bcfa2724181b5f4a11649d684995498e67c169a04ab1a"
  },
];

async function deployStoryPoolFixture() {

  // Get the ContractFactory and Signers here.
  const WIP = await ethers.getContractFactory("WIP");
  const RewardsManager = await ethers.getContractFactory("RewardsManager");
  const StakedIP = await ethers.getContractFactory("StakedIP");
  const Withdrawal = await ethers.getContractFactory("Withdrawal");
  const IPTokenStaking = await ethers.getContractFactory("IPTokenStaking");

  const [
    owner,
    operator,
    treasury,
    alice,
    bob,
    carl
  ] = await ethers.getSigners();

  const WIPContract = await WIP.deploy();
  await WIPContract.waitForDeployment();

  // struct InitializerArgs {
  //     address owner;
  //     uint256 minStakeAmount;
  //     uint256 minUnstakeAmount;
  //     uint256 minCommissionRate;
  //     uint256 fee;
  // }
  const initializerArgs = [
    owner.address,
    ethers.parseUnits("1024", 18),
    ethers.parseUnits("1024", 18),
    500n,
    ethers.parseUnits("1", 18),
  ]
  const IPTokenStakingContract = await upgrades.deployProxy(
    IPTokenStaking,
    [ initializerArgs ],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      constructorArgs: [ethers.parseUnits("1", 18), 200n]
    }
  );
  await IPTokenStakingContract.waitForDeployment();

  const StakedIPContract = await upgrades.deployProxy(
    StakedIP,
    [ 
      // address _ipTokenStaking,
      IPTokenStakingContract.target,
      // IERC20 _asset,
      WIPContract.target,
      // string memory _stIPName,
      "Staked IP Token",
      // string memory _stIPSymbol,
      "stIP",
      // uint _minDepositAmount,
      ethers.parseUnits("1", 18),
      // address _operator,
      operator.address,
      // address _owner,
      owner.address,
      // bytes[] calldata _validatorsPubkey,
      [
        DUMMY_VALIDATOR_SET[0].publicKey,
        DUMMY_VALIDATOR_SET[1].publicKey,
        DUMMY_VALIDATOR_SET[2].publicKey
      ],
      // uint16[] calldata _validatorsStakePercent
      [ 2000, 3000, 5000 ],
    ],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor"]
    }
  );
  await StakedIPContract.waitForDeployment();

  const RewardsManagerContract = await RewardsManager.deploy(
    // address _owner,
    owner.address,
    // address _stakedIP,
    StakedIPContract.target,
    // address _treasury,
    treasury.address,
    // uint256 _rewardsFeeBp
    500n
  );
  await RewardsManagerContract.waitForDeployment();

  const WithdrawalContract = await upgrades.deployProxy(
    Withdrawal,
    [ 
      // address payable _stIP
      StakedIPContract.target,
    ],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor"]
    }
  );
  await WithdrawalContract.waitForDeployment();

  const FEE = await IPTokenStakingContract.fee();

  // todo: will the initial deposit be at initialization?
  await StakedIPContract.updateRewardsManager(RewardsManagerContract.target, { value: FEE });
  await StakedIPContract.updateWithdrawal(WithdrawalContract.target, { value: FEE });

  return {
    IPTokenStakingContract,
    RewardsManagerContract,
    StakedIPContract,
    WIPContract,
    WithdrawalContract,

    FEE,

    owner,
    operator,
    treasury,
    alice,
    bob,
    carl,
  };
}

module.exports = {
  ONE_DAY_SECONDS,
  DUMMY_VALIDATOR_SET,
  MLARGE,
  GWEI,
  deployStoryPoolFixture,
};