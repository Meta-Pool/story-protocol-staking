const { expect } = require("chai");
const { ethers, upgrades, network } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployStoryPoolFixture,
  ONE_DAY_SECONDS,
  DUMMY_VALIDATOR_SET,
  GWEI,
} = require("./testSetup");
const { getPercentage } = require("./utils");

describe("Staked IP 🐍 - Stake IP tokens in Meta Pool ----", function () {
  const fixtures = [deployStoryPoolFixture];

  fixtures.forEach((fixture, index) => {
    describe("Deploying Staked IP protocol", function () {
      it(`[T100]-${index + 1} StakedIPContract initial parameters are correct.`, async function () {
        const {
          IPTokenStakingContract,
          RewardsManagerContract,
          StakedIPContract,
          WIPContract,
          WithdrawalContract,

          owner,
          operator,
          treasury,
          alice,
          bob,
          carl,
        } = await loadFixture(fixture);

        expect(await StakedIPContract.owner()).to.be.equal(owner.address);
        expect(await StakedIPContract.fullyOperational()).to.be.equal(true);

        expect(await StakedIPContract.minDepositAmount()).to.be.equal(ethers.parseEther("1"));
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(await IPTokenStakingContract.minStakeAmount());
        expect(await StakedIPContract.ipTokenStaking()).to.be.equal(IPTokenStakingContract.target);
        expect(await StakedIPContract.operator()).to.be.equal(operator.address);

        expect(await StakedIPContract.asset()).to.be.equal(WIPContract.target);
        expect(await StakedIPContract.totalSupply()).to.be.equal(await IPTokenStakingContract.minStakeAmount());

        // todo: will the initial deposit be at initialization?
        // expect(await StakedIPContract.rewardsManager()).to.be.equal(RewardsManagerContract.target);
        // expect(await StakedIPContract.withdrawal()).to.be.equal(WithdrawalContract.target);
        // expect(await StakedIPContract.totalAssets()).to.be.equal(0);
      });

      it(`[T101]-${index + 1} RewardsManagerContract initial parameters are correct.`, async function () {
        const {
          RewardsManagerContract,
          StakedIPContract,
          owner,
          treasury,
        } = await loadFixture(fixture);

        expect(await RewardsManagerContract.owner()).to.be.equal(owner.address);
        expect(await RewardsManagerContract.treasury()).to.be.equal(treasury.address);
        expect(await RewardsManagerContract.stakedIP()).to.be.equal(StakedIPContract.target);
        expect(await RewardsManagerContract.rewardsFeeBp()).to.be.equal(500n);

        const [rewards, treasuryFee] = await RewardsManagerContract.getManagerAccrued()
        expect(rewards).to.be.equal(0);
        expect(treasuryFee).to.be.equal(0);
      });

      it(`[T102]-${index + 1} WithdrawalContract initial parameters are correct.`, async function () {
        const {
          StakedIPContract,
          WithdrawalContract,
          owner,
        } = await loadFixture(fixture);

        expect(await WithdrawalContract.owner()).to.be.equal(owner.address);
        expect(await WithdrawalContract.stIP()).to.be.equal(StakedIPContract.target);
        expect(await WithdrawalContract.totalPendingWithdrawals()).to.be.equal(0);
        expect(await WithdrawalContract.validatorsDisassembleTime()).to.be.equal(14n * ONE_DAY_SECONDS);
      });
    });

    describe("Trigger all unit errors", function () {
      it(`[T103]-${index + 1} RewardsManagerContract - InvalidAddressZero().`, async function () {
        const {
          RewardsManagerContract,
          owner,
          StakedIPContract,
          treasury,
        } = await loadFixture(fixture);

        await expect(
          RewardsManagerContract.connect(owner).updateTreasury(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(RewardsManagerContract, "InvalidAddressZero");
        expect(await RewardsManagerContract.treasury()).to.be.equal(treasury.address);

        // At deployment:
        const RewardsManager = await ethers.getContractFactory("RewardsManager");
        await expect(
          RewardsManager.deploy(
            owner.address,
            ethers.ZeroAddress,
            treasury.address,
            500n
          )
        ).to.be.revertedWithCustomError(RewardsManager, "InvalidAddressZero");

        await expect(
          RewardsManager.deploy(
            owner.address,
            StakedIPContract.target,
            ethers.ZeroAddress,
            500n
          )
        ).to.be.revertedWithCustomError(RewardsManager, "InvalidAddressZero");
      });

      it(`[T104]-${index + 1} RewardsManagerContract - InvalidRewardsFee().`, async function () {
        const {
          RewardsManagerContract,
          StakedIPContract,
          owner,
          treasury,
        } = await loadFixture(fixture);

        const MAX_REWARDS_FEE = 4000n;

        await expect(
          RewardsManagerContract.connect(owner).updateRewardsFee(MAX_REWARDS_FEE + 1n)
        ).to.be.revertedWithCustomError(RewardsManagerContract, "InvalidRewardsFee");
        expect(await RewardsManagerContract.rewardsFeeBp()).to.be.equal(500n);

        // At deployment:
        const RewardsManager = await ethers.getContractFactory("RewardsManager");
        await expect(
          RewardsManager.deploy(
            owner.address,
            StakedIPContract.target,
            treasury.address,
            MAX_REWARDS_FEE + 1n
          )
        ).to.be.revertedWithCustomError(RewardsManager, "InvalidRewardsFee");
      });

      it(`[T105]-${index + 1} RewardsManagerContract - OwnableUnauthorizedAccount().`, async function () {
        const {
          RewardsManagerContract,
          alice,
        } = await loadFixture(fixture);

        await expect(
          RewardsManagerContract.connect(alice).updateTreasury(alice.address)
        ).to.be.revertedWithCustomError(RewardsManagerContract, "OwnableUnauthorizedAccount");
        await expect(
          RewardsManagerContract.connect(alice).updateRewardsFee(501n)
        ).to.be.revertedWithCustomError(RewardsManagerContract, "OwnableUnauthorizedAccount");
      });

      it(`[T106]-${index + 1} StakedIPContract - InvalidZeroAmount().`, async function () {
        const {
          StakedIPContract,
          alice,
          owner
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(alice).depositIP(alice.address, { value: 0 })
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");

        await StakedIPContract.connect(owner).setRewarderWhitelisted(alice.address, true);

        await expect(
          StakedIPContract.connect(alice).injectRewards({ value: 0 })
        ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");

        await expect(
          StakedIPContract.connect(alice).withdraw(0, alice.address, alice.address)
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");
      });

      it(`[T107]-${index + 1} StakedIPContract - InvalidZeroAddress().`, async function () {
        const {
          StakedIPContract,
          FEE,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).updateWithdrawal(ethers.ZeroAddress, { value: FEE })
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAddress");

        await expect(
          StakedIPContract.connect(owner).updateRewardsManager(ethers.ZeroAddress, { value: FEE })
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAddress");

        await expect(
          StakedIPContract.connect(owner).updateOperator(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAddress");
      });

      it(`[T108]-${index + 1} StakedIPContract - LessThanMinDeposit().`, async function () {
        const {
          StakedIPContract,
          owner,
          alice,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).updateMinDepositAmount(GWEI - 1n)
        ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");

        await expect(
          StakedIPContract.connect(owner).injectRewards({ value: (await StakedIPContract.minDepositAmount()) - 1n })
        ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");

        await expect(
          StakedIPContract.connect(alice).depositIP(alice.address, { value: (await StakedIPContract.minDepositAmount()) - 1n })
        ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");
      });

      it(`[T109]-${index + 1} StakedIPContract - OperatorUnauthorized().`, async function () {
        const {
          StakedIPContract,
          FEE,
          alice,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(alice).coverWithdrawals(GWEI)
        ).to.be.revertedWithCustomError(StakedIPContract, "OperatorUnauthorized");

        await expect(
          StakedIPContract.connect(alice).stake(
            // bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // IIPTokenStaking.StakingPeriod _period,
            1,
            // bytes calldata _extraData
            "0x",
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "OperatorUnauthorized");

        await expect(
          StakedIPContract.connect(alice).unstake(
            //     bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            //     uint _amount,
            ethers.parseEther("1"),
            //     uint _delegation_id,
            1,
            //     bytes calldata _extraData
            "0x",
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "OperatorUnauthorized");

        await expect(
          StakedIPContract.connect(alice).redelegate(
            // bytes calldata _oldValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // bytes calldata _newValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[1].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // uint _delegation_id
            1,
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "OperatorUnauthorized");
      });

      it(`[T110]-${index + 1} StakedIPContract - InvalidIPFee().`, async function () {
        const {
          StakedIPContract,
          WithdrawalContract,
          RewardsManagerContract,
          FEE,
          owner,
          operator,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).updateWithdrawal(WithdrawalContract.target, { value: FEE + 1n })
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidIPFee");

        await expect(
          StakedIPContract.connect(owner).updateRewardsManager(RewardsManagerContract.target, { value: FEE - 1n })
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidIPFee");

        await expect(
          StakedIPContract.connect(operator).unstake(
            //     bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            //     uint _amount,
            ethers.parseEther("1"),
            //     uint _delegation_id,
            1,
            //     bytes calldata _extraData
            "0x",
            { value: FEE - 1n }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidIPFee");

        await expect(
          StakedIPContract.connect(operator).redelegate(
            // bytes calldata _oldValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // bytes calldata _newValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[1].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // uint _delegation_id
            1,
            { value: FEE + 1n }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidIPFee");
      });

      it(`[T111]-${index + 1} StakedIPContract - NotFullyOperational().`, async function () {
        const {
          StakedIPContract,
          WithdrawalContract,
          RewardsManagerContract,
          FEE,
          owner,
          operator,
          alice,
        } = await loadFixture(fixture);

        await StakedIPContract.connect(alice).depositIP(alice.address, { value: ethers.parseEther("1") });

        await StakedIPContract.connect(owner).toggleContractOperation();

        await expect(
          StakedIPContract.connect(alice).depositIP(alice.address, { value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");

        await expect(
          StakedIPContract.connect(alice).withdraw(ethers.parseEther("1"), alice.address, alice.address)
        ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");

        await expect(
          StakedIPContract.connect(operator).stake(
            // bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // IIPTokenStaking.StakingPeriod _period,
            1,
            // bytes calldata _extraData
            "0x",
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");

        await expect(
          StakedIPContract.connect(operator).unstake(
            //     bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            //     uint _amount,
            ethers.parseEther("1"),
            //     uint _delegation_id,
            1,
            //     bytes calldata _extraData
            "0x",
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");

        await expect(
          StakedIPContract.connect(operator).redelegate(
            // bytes calldata _oldValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // bytes calldata _newValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[1].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // uint _delegation_id
            1,
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
      });

      // withdrawal
      // error Unauthorized(address _caller, address _authorized);
      // error NotEnoughIPtoStake(uint _requested, uint _available);
      // error ClaimTooSoon(uint timestampUnlock);
      // error InvalidDisassembleTime(uint valueSent, uint maxValue);
      // error InvalidRequest();
      // error InvalidRequestId(address _user, uint _request_id);
      // error WithdrawAlreadeCompleted(address _user, uint _request_id);
      // error UserMaxWithdrawalsReached(address _user);
      // error OwnableUnauthorizedAccount(address account);
      it(`[T112]-${index + 1} StakedIPContract - ValidatorNotListed().`, async function () {
        const {
          StakedIPContract,
          FEE,
          operator,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(operator).stake(
            // bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[3].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // IIPTokenStaking.StakingPeriod _period,
            1,
            // bytes calldata _extraData
            "0x",
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorNotListed");

        await expect(
          StakedIPContract.connect(operator).unstake(
            //     bytes calldata _validatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[3].publicKey,
            //     uint _amount,
            ethers.parseEther("1"),
            //     uint _delegation_id,
            1,
            //     bytes calldata _extraData
            "0x",
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorNotListed");

        await expect(
          StakedIPContract.connect(operator).redelegate(
            // bytes calldata _oldValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[0].publicKey,
            // bytes calldata _newValidatorUncmpPubkey,
            DUMMY_VALIDATOR_SET[3].publicKey,
            // uint _amount,
            ethers.parseEther("1"),
            // uint _delegation_id
            1,
            { value: FEE }
          )
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorNotListed");
      });

      it(`[T113]-${index + 1} StakedIPContract - OwnableUnauthorizedAccount().`, async function () {
        const {
          StakedIPContract,
          FEE,
          alice,
          operator,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(operator).updateWithdrawal(operator.address, { value: FEE })
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).updateRewardsManager(operator.address, { value: FEE })
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).toggleContractOperation()
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).updateMinDepositAmount(ethers.parseEther("1"))
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).updateOperator(alice.address)
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).updateValidatorsTarget([5000, 2000, 3000])
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).bulkRemoveValidators([DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[1].publicKey])
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).bulkInsertValidators([DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[1].publicKey])
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");

        await expect(
          StakedIPContract.connect(operator).replaceOneValidator(DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[3].publicKey)
        ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");
      });

      it(`[T114]-${index + 1} StakedIPContract - ValidatorAlreadyListed().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).bulkInsertValidators([DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[3].publicKey])
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorAlreadyListed");

        await expect(
          StakedIPContract.connect(owner).replaceOneValidator(DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[1].publicKey)
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorAlreadyListed");
      });

      it(`[T115]-${index + 1} StakedIPContract - ValidatorHasTargetPercent().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).bulkRemoveValidators([DUMMY_VALIDATOR_SET[0].publicKey])
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorHasTargetPercent");
      });

      it(`[T116]-${index + 1} StakedIPContract - MaxValidatorsExceeded().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).bulkInsertValidators([
            DUMMY_VALIDATOR_SET[3].publicKey,
            DUMMY_VALIDATOR_SET[4].publicKey,
            DUMMY_VALIDATOR_SET[5].publicKey,
            DUMMY_VALIDATOR_SET[6].publicKey,
            DUMMY_VALIDATOR_SET[7].publicKey,
            DUMMY_VALIDATOR_SET[8].publicKey,
            DUMMY_VALIDATOR_SET[9].publicKey,
            DUMMY_VALIDATOR_SET[10].publicKey
          ])
        ).to.be.revertedWithCustomError(StakedIPContract, "MaxValidatorsExceeded");
      });

      it(`[T117]-${index + 1} StakedIPContract - ShouldBeOneHundred().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).updateValidatorsTarget([5000, 2000, 2000])
        ).to.be.revertedWithCustomError(StakedIPContract, "ShouldBeOneHundred");
      });

      it(`[T118]-${index + 1} StakedIPContract - ArraySizeMismatch().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).updateValidatorsTarget([5000, 2000, 2000, 1000])
        ).to.be.revertedWithCustomError(StakedIPContract, "ArraySizeMismatch");
      });

      it(`[T119]-${index + 1} StakedIPContract - ValidatorNotFount().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(owner).getValidatorIndex(DUMMY_VALIDATOR_SET[3].publicKey)
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorNotFount");
      });

      it(`[T120]-${index + 1} StakedIPContract - ValidatorsEmptyList().`, async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);

        // notice: there is no way to reach that error!

        // await StakedIPContract.connect(owner).updateValidatorsTarget([0, 0, 0]);
        await expect(
          StakedIPContract.connect(owner).bulkRemoveValidators([DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[1].publicKey, DUMMY_VALIDATOR_SET[2].publicKey])
          // ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorsEmptyList");
        ).to.be.revertedWithCustomError(StakedIPContract, "ValidatorHasTargetPercent");
      });
    });

    describe("Updatable values", function () {
      it(`[T121] updateWithdrawal() - Set new withrawal`, async function () {
        const {
          StakedIPContract,
          owner,
          FEE,
          bob
        } = await loadFixture(fixture);

        await StakedIPContract.connect(owner).updateWithdrawal(bob.address, { value: FEE });

        expect(await StakedIPContract.withdrawal()).to.be.equal(bob.address);
      });

      it("[T122] updateRewardsManager() - Set new rewards manager", async function () {
        const {
          StakedIPContract,
          owner,
          FEE,
          bob
        } = await loadFixture(fixture);

        await StakedIPContract.connect(owner).updateRewardsManager(bob.address, { value: FEE });

        expect(await StakedIPContract.rewardsManager()).to.be.equal(bob.address);
      });

      it("[T123] updateMinDepositAmount() - Set new min deposit amount", async function () {
        const {
          StakedIPContract,
          owner,
        } = await loadFixture(fixture);
        const newMinAmount = ethers.parseEther("2");

        await StakedIPContract.connect(owner).updateMinDepositAmount(newMinAmount);

        expect(await StakedIPContract.minDepositAmount()).to.be.equal(newMinAmount);
      });

      it("[T124] updateOperator() - Set new operator", async function () {
        const {
          StakedIPContract,
          owner,
          bob
        } = await loadFixture(fixture);

        await StakedIPContract.connect(owner).updateOperator(bob.address);

        expect(await StakedIPContract.operator()).to.be.equal(bob.address);
      });

      it("[T125] toggleContractOperation() - Disable contract fully operational", async function () {
        const {
          StakedIPContract,
          owner,
          FEE,
          bob
        } = await loadFixture(fixture);

        expect(await StakedIPContract.fullyOperational()).to.be.equal(true);

        await StakedIPContract.connect(owner).toggleContractOperation();

        expect(await StakedIPContract.fullyOperational()).to.be.equal(false);
      });

      it("[T126] setRewarderWhitelisted() - Set new whitelisted rewarder", async function () {
        const {
          StakedIPContract,
          owner,
          bob
        } = await loadFixture(fixture);

        expect(await StakedIPContract.isRewarderWhitelisted(bob.address)).to.be.equal(false);

        await StakedIPContract.connect(owner).setRewarderWhitelisted(bob.address, true);

        expect(await StakedIPContract.isRewarderWhitelisted(bob.address)).to.be.equal(true);
      });

      it("[T126] setRewarderWhitelisted() - Remove whitelisted rewarder", async function () {
        const {
          StakedIPContract,
          owner,
          bob
        } = await loadFixture(fixture);

        expect(await StakedIPContract.isRewarderWhitelisted(bob.address)).to.be.equal(false);

        await StakedIPContract.connect(owner).setRewarderWhitelisted(bob.address, true);

        expect(await StakedIPContract.isRewarderWhitelisted(bob.address)).to.be.equal(true);

        await StakedIPContract.connect(owner).setRewarderWhitelisted(bob.address, false);

        expect(await StakedIPContract.isRewarderWhitelisted(bob.address)).to.be.equal(false);
      });
    });

    describe("Deposit", function () {
      it("[T127] depositIP() - Deposit IP tokens with price 1:1", async function () {
        const {
          StakedIPContract,
          alice
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlying = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
      });

      it("[T128] depositIP() - Deposit IP tokens with price 1:2", async function () {
        const {
          StakedIPContract,
          operator,
          alice
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

        const totalUnderlying = await StakedIPContract.totalUnderlying()

        await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + (depositAmount / 2n));
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount / 2n);
      });

      it("[T128] depositIP() - Deposit IP tokens with price 1:0.95", async function () {
        const {
          StakedIPContract,
          owner,
          operator,
          alice
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
        await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

        const totalUnderlying = await StakedIPContract.totalUnderlying()

        const stIPPrice = await StakedIPContract.getStIPPrice()

        await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

        const expectedIncrement = depositAmount * BigInt(1e18) / stIPPrice;

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedIncrement);
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedIncrement);
      });

      it("[T129] deposit() - Deposit wIP tokens with price 1:1", async function () {
        const {
          StakedIPContract,
          alice,
          WIPContract
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlying = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await WIPContract.connect(alice).deposit({ value: depositAmount });

        await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
        await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
      });

      it("[T130] deposit() - Deposit wIP tokens with price 1:2", async function () {
        const {
          StakedIPContract,
          operator,
          alice,
          WIPContract
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

        const totalUnderlying = await StakedIPContract.totalUnderlying()

        await WIPContract.connect(alice).deposit({ value: depositAmount });

        await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
        await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + (depositAmount / 2n));
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount / 2n);
      });

      it("[T131] deposit() - Deposit wIP tokens with price 1:0.95", async function () {
        const {
          StakedIPContract,
          owner,
          operator,
          alice,
          WIPContract
        } = await loadFixture(fixture);

        const totalSupply = await StakedIPContract.totalSupply(),
          totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
          depositAmount = ethers.parseEther("5");

        await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
        await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

        const totalUnderlying = await StakedIPContract.totalUnderlying()

        await WIPContract.connect(alice).deposit({ value: depositAmount });

        await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
        await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

        const stIPPrice = await StakedIPContract.getStIPPrice()

        const expectedIncrement = depositAmount * BigInt(1e18) / stIPPrice;

        expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedIncrement);
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
        expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedIncrement);
      });
    });
  });
});
