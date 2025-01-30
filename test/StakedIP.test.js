const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployStoryPoolFixture,
  ONE_DAY_SECONDS,
  GWEI,
} = require("./testSetup");

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
        expect(await StakedIPContract.totalUnderlying()).to.be.equal(0);
        expect(await StakedIPContract.ipTokenStaking()).to.be.equal(IPTokenStakingContract.target);
        expect(await StakedIPContract.operator()).to.be.equal(operator.address);

        expect(await StakedIPContract.asset()).to.be.equal(WIPContract.target);
        expect(await StakedIPContract.totalSupply()).to.be.equal(0);

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

    // stakedIP
    // error LessThanMinDeposit();
    // error NotEnoughIPSent();
    // error Unauthorized();
    // error InvalidOperationsFee();
    // error NotFullyOperational();
    // error ValidatorNotListed(bytes _validatorUncmpPubkey);
    // error OwnableUnauthorizedAccount(address account);

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
    describe("Trigger all unit errors", function () {
      it(`[T103]-${index + 1} RewardsManagerContract - InvalidAddressZero().`, async function () {
        const {
          RewardsManagerContract,
          owner,
          StakedIPContract,
          treasury,
        } = await loadFixture(fixture);

        await expect(
          RewardsManagerContract.updateTreasury(ethers.ZeroAddress)
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
          RewardsManagerContract.updateRewardsFee(MAX_REWARDS_FEE + 1n)
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
        } = await loadFixture(fixture);

        await expect(
          StakedIPContract.connect(alice).depositIP(alice.address, {value: 0})
        ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");

        await expect(
          StakedIPContract.connect(alice).injectRewards({value: 0})
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
    });
  });
});
