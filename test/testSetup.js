const { ethers, upgrades } = require("hardhat");
const { WRAPPED_NATIVE } = require("../constants");
const { contract } = require("./utils");
const { FORK_CHAIN } = require("../scripts/env");

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
  {
    "path": "m/44'/60'/0'/0/4",
    "address": "0x6Ec76577D98f08fC59Ad2476E30aA45c5e7b9346",
    "publicKey": "0x0213cc3f8cb2241699feb255038033a66ac75335f93b8ee8aaafa1e488c51e0e3b",
    "privateKey": "0x1e4f6c562639a0a3fbfa89c0cb46c8d5ef77cc1a6ec90261648c292fa05f7760"
  },
  {
    "path": "m/44'/60'/0'/0/5",
    "address": "0x92a0AcEbAFfE72257E37daF957d24b5c538a2e65",
    "publicKey": "0x029bda26fdf3730857df9f3538ba0c604fbf59bf38cacf25503db38d1853fa930b",
    "privateKey": "0x247c21748b5d7727fff92ca60f04b1d4e17dbf200b70e09772e23b4e335cedef"
  },
  {
    "path": "m/44'/60'/0'/0/6",
    "address": "0x827AF2D870170400416AdbcE7e8FaE8dFEB7b579",
    "publicKey": "0x036ae419dc9b18e3f5e3bf72068861b6e06a033ca22495faad8df99be1204af29f",
    "privateKey": "0x03d4e0cf40e603b4c565ba12dc40d0576ac48b28e09140d6062cad2d17f8bed2"
  },
  {
    "path": "m/44'/60'/0'/0/7",
    "address": "0x274Fa50C32F9BB87bcB66b7603aF9b52e4b96FA3",
    "publicKey": "0x03535a681631374ba452e9b7a5336398fef967f4d54a744dd5c1ea80deb6d4096d",
    "privateKey": "0xeb10c11078d1d65491c470bcba1ae28a7b1fd7e03ec57620bfa78bea71960618"
  },
  {
    "path": "m/44'/60'/0'/0/8",
    "address": "0xb38a5F6d6570f2CAD43Ace88AaA96D8E6ccc6261",
    "publicKey": "0x03e514c6336840541e7c3d850c47cae83aa400890f11e1d520379b7d378ef2cffb",
    "privateKey": "0x35d06dab18941082496752a58820dcc40496650ab13cb2b3a511a2968f6a55c7"
  },
  {
    "path": "m/44'/60'/0'/0/9",
    "address": "0xEf064789678bE3dd7d52F044A05D6CaF6348F9d9",
    "publicKey": "0x039bc0deb5c382d63a6a35613f2185e54786d1a3436bbe19e8d9af68400f186285",
    "privateKey": "0xc5df73761d9e21560fef0590388d218321568d2cdfae7da0ecd96065fa1d586e"
  },
  {
    "path": "m/44'/60'/0'/0/10",
    "address": "0x9e6061d20A01b528cCa0787ecf8E9635006201E3",
    "publicKey": "0x03e77635e2de9c00bdf02f6c4ca3f9eca4dca2b9ff2167ef62f439768f37c49b0d",
    "privateKey": "0x8259129579cb67d954bd46a10609eb602111fe55b540276a2d2f28dc077e2283"
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
    deployer,
    owner,
    operator,
    treasury,
    alice,
    bob,
    carl
  ] = await ethers.getSigners();

  let WIPContract
  if (FORK_CHAIN) {
    WIPContract = await contract(WRAPPED_NATIVE, "IWIP")
  } else {
    WIPContract = await WIP.deploy();
    await WIPContract.waitForDeployment();
  }

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
    [initializerArgs],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      constructorArgs: [ethers.parseUnits("1", 18), 200n]
    }
  );
  await IPTokenStakingContract.waitForDeployment();

  const FEE = await IPTokenStakingContract.fee();

  const StakedIPContract = await upgrades.deployProxy(
    StakedIP,
    [
      // address _operator,
      operator.address,
      // IIPTokenStaking _ipTokenStaking,
      IPTokenStakingContract.target,
      // IERC20 _asset,
      WIPContract.target,
      // string memory _stIPName,
      "Staked IP Token",
      // string memory _stIPSymbol,
      "stIP",
      // uint256 _minDepositAmount,
      ethers.parseUnits("1", 18),
      // bytes[] calldata _validatorsPubkey,
      [
        DUMMY_VALIDATOR_SET[0].publicKey,
        DUMMY_VALIDATOR_SET[1].publicKey,
        DUMMY_VALIDATOR_SET[2].publicKey
      ],
      // uint16[] calldata _validatorsStakePercent
      [2000, 3000, 5000],
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
      // address _owner,
      owner.address,
      // address _operator,
      operator.address,
      // address payable _stIP,
      StakedIPContract.target,
    ],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor"]
    }
  );
  await WithdrawalContract.waitForDeployment();

  await StakedIPContract.setupStaking(
    // address _owner,
    owner.address,
    // address _withdrawal,
    WithdrawalContract.target,
    // address _rewardsManager,
    RewardsManagerContract.target,
    // bytes calldata _validatorUncmpPubkey,
    DUMMY_VALIDATOR_SET[0].publicKey,
    // IIPTokenStaking.StakingPeriod _period
    0,
    { value: FEE + FEE + (await IPTokenStakingContract.minStakeAmount()) }
  );

  await StakedIPContract.connect(owner).acceptOwnership();

  // todo: will the initial deposit be at initialization?
  // await StakedIPContract.updateRewardsManager(RewardsManagerContract.target, { value: FEE });
  // await StakedIPContract.updateWithdrawal(WithdrawalContract.target, { value: FEE });

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