const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployStoryPoolFixture,
} = require("./testSetup");

const MLARGE = ethers.parseEther("100000000");

describe("Staked IP 🐍 - Stake IP tokens in Meta Pool ----", function () {
  const fixtures = [deployStoryPoolFixture];

  fixtures.forEach((fixture, index) => {
    describe("Deploying Staked IP protocol", function () {
      it(`[T100]-${index + 1} Initial parameters are correct.`, async function () {
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

        // const aliceUSDTBalance = await USDTTokenContract.balanceOf(alice.address);
        // expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(0);

        // expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
        // // console.log("Total Assets: ", await StakedVerdeContract.totalAssets());
        // // console.log("Alice Balanc: ", aliceUSDTBalance);
        // await USDTTokenContract.connect(alice).approve(StakedStableContract.target, aliceUSDTBalance);
        // await StakedStableContract.connect(alice).swapAndStakeVerde(SwapVerdeContract.target, aliceUSDTBalance, 0);
        // expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
        // const [previewVerde, swapFee] = await SwapVerdeContract.previewStableToVerde(aliceUSDTBalance);
        // expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(
        //   await StakedVerdeContract.previewDeposit(previewVerde)
        // );
        // expect(await SwapVerdeContract.getStableLiquidity()).to.be.equal(
        //   aliceUSDTBalance
        // );

        // // fees
        // expect(await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)).to.be.equal(swapFee);
        // // expect(await TreasuryVaultContract.totalCollectedInterests()).to.be.equal(0);
      });

    //   it(`[T301]-${index + 1} swapAndStakeVerde() [after some deposits].`, async function () {
    //     const {
    //       MPETHTokenContract,
    //       USDTTokenContract,
    //       BorrowVerdeContract,
    //       StakedVerdeContract,
    //       VerdeTokenContract,
    //       SwapVerdeContract,
    //       StakedStableContract,
    //       TreasuryVaultContract,
    //       alice,
    //       bob,
    //       carl
    //     } = await loadFixture(fixture);

    //     await MPETHTokenContract.connect(alice).approve(BorrowVerdeContract.target, ethers.parseEther("5"));
    //     await BorrowVerdeContract.connect(alice).depositCollateral(alice.address, ethers.parseEther("5"));
    //     await MPETHTokenContract.connect(bob).approve(BorrowVerdeContract.target, ethers.parseEther("0.2"));
    //     await BorrowVerdeContract.connect(bob).depositCollateral(bob.address, ethers.parseEther("0.2"));
    //     await MPETHTokenContract.connect(carl).approve(BorrowVerdeContract.target, ethers.parseEther("2"));
    //     await BorrowVerdeContract.connect(carl).depositCollateral(carl.address, ethers.parseEther("2"));

    //     const aliceLoan = 10_000_000_000n; // 10,000 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(alice.address)).to.be.greaterThanOrEqual(aliceLoan);
    //     const bobLoan = 505_000_000n; // 505 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(bob.address)).to.be.greaterThanOrEqual(bobLoan);
    //     const carlLoan = 2_003_000_000n; // 2,003 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(carl.address)).to.be.greaterThanOrEqual(carlLoan);

    //     await BorrowVerdeContract.connect(alice).borrow(aliceLoan);
    //     await BorrowVerdeContract.connect(bob).borrow(bobLoan);
    //     await BorrowVerdeContract.connect(carl).borrow(carlLoan);
    //     const initialBorrowFee = await VerdeTokenContract.balanceOf(TreasuryVaultContract.target);

    //     // console.log("balance: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));
    //     const oBalance = await VerdeTokenContract.balanceOf(TreasuryVaultContract.target);
    //     await time.increase(ONE_DAY_IN_SECS_PLUS);
    //     await BorrowVerdeContract.accrue();

    //     for (i = 0; i < 365; i++) {
    //       await time.increase(ONE_DAY_IN_SECS_PLUS);
    //       await BorrowVerdeContract.accrue();
    //     }
    //     const interests = (await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)) - oBalance;
    //     // console.log("balance: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));

    //     expect(await VerdeTokenContract.balanceOf(alice.address)).to.be.equal(aliceLoan);
    //     expect(await VerdeTokenContract.balanceOf(bob.address)).to.be.equal(bobLoan);
    //     expect(await VerdeTokenContract.balanceOf(carl.address)).to.be.equal(carlLoan);

    //     await VerdeTokenContract.connect(alice).approve(StakedVerdeContract.target, aliceLoan);
    //     await VerdeTokenContract.connect(bob).approve(StakedVerdeContract.target, bobLoan);
    //     await VerdeTokenContract.connect(carl).approve(StakedVerdeContract.target, carlLoan);

    //     // console.log("balance: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));

    //     // console.log(await StakedVerdeContract.totalAssets(), await StakedVerdeContract.totalSupply());
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(alice).deposit(aliceLoan, alice.address);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(bob).deposit(bobLoan, bob.address);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(carl).deposit(carlLoan, carl.address);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());

    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(aliceLoan);
    //     expect(await StakedVerdeContract.balanceOf(bob.address)).to.be.equal(bobLoan);
    //     expect(await StakedVerdeContract.balanceOf(carl.address)).to.be.equal(carlLoan);

    //     /// --- adding liquidity.
    //     expect(await SwapVerdeContract.getStableLiquidity()).to.be.equal(0);
    //     const aliceUSDTBalance = await USDTTokenContract.balanceOf(alice.address);
    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(aliceLoan);

    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await USDTTokenContract.connect(alice).approve(StakedStableContract.target, aliceUSDTBalance);
    //     await StakedStableContract.connect(alice).swapAndStakeVerde(SwapVerdeContract.target, aliceUSDTBalance, 0);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     const [previewVerde, swapFee] = await SwapVerdeContract.previewStableToVerde(aliceUSDTBalance);
    //     expect(await StakedVerdeContract.balanceOf(alice.address) - aliceLoan).to.be.equal(
    //       await StakedVerdeContract.previewDeposit(previewVerde)
    //     );
    //     expect(await SwapVerdeContract.getStableLiquidity()).to.be.equal(aliceUSDTBalance);

    //     // fees
    //     expect(await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)).to.be.equal(
    //       interests + initialBorrowFee + swapFee
    //     );
    //   });

    //   it(`[T302]-${index + 1} swapAndStakeVerde() [after some deposits and price increase].`, async function () {
    //     const {
    //       MPETHTokenContract,
    //       USDTTokenContract,
    //       BorrowVerdeContract,
    //       StakedVerdeContract,
    //       VerdeTokenContract,
    //       SwapVerdeContract,
    //       StakedStableContract,
    //       TreasuryVaultContract,
    //       owner,
    //       alice,
    //       bob,
    //       carl,
    //       bot
    //     } = await loadFixture(fixture);

    //     await MPETHTokenContract.connect(alice).approve(BorrowVerdeContract.target, ethers.parseEther("5"));
    //     await BorrowVerdeContract.connect(alice).depositCollateral(alice.address, ethers.parseEther("5"));
    //     await MPETHTokenContract.connect(bob).approve(BorrowVerdeContract.target, ethers.parseEther("0.2"));
    //     await BorrowVerdeContract.connect(bob).depositCollateral(bob.address, ethers.parseEther("0.2"));
    //     await MPETHTokenContract.connect(carl).approve(BorrowVerdeContract.target, ethers.parseEther("2"));
    //     await BorrowVerdeContract.connect(carl).depositCollateral(carl.address, ethers.parseEther("2"));

    //     const aliceLoan = 10_000_000_000n; // 10,000 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(alice.address)).to.be.greaterThanOrEqual(aliceLoan);
    //     const bobLoan = 505_000_000n; // 505 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(bob.address)).to.be.greaterThanOrEqual(bobLoan);
    //     const carlLoan = 2_003_000_000n; // 2,003 USD
    //     expect(await BorrowVerdeContract.getSafeLoan(carl.address)).to.be.greaterThanOrEqual(carlLoan);

    //     await BorrowVerdeContract.connect(alice).borrow(aliceLoan);
    //     await BorrowVerdeContract.connect(bob).borrow(bobLoan);
    //     await BorrowVerdeContract.connect(carl).borrow(carlLoan);
    //     const initialBorrowFee = await VerdeTokenContract.balanceOf(TreasuryVaultContract.target);

    //     // console.log("balance: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));
    //     const oBalance = await VerdeTokenContract.balanceOf(TreasuryVaultContract.target);
    //     await time.increase(ONE_DAY_IN_SECS_PLUS);
    //     await BorrowVerdeContract.accrue();

    //     for (i = 0; i < 365; i++) {
    //       await time.increase(ONE_DAY_IN_SECS_PLUS);
    //       await BorrowVerdeContract.accrue();
    //     }
    //     const interests = (await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)) - oBalance;
    //     // console.log("balance: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));

    //     expect(await VerdeTokenContract.balanceOf(alice.address)).to.be.equal(aliceLoan);
    //     expect(await VerdeTokenContract.balanceOf(bob.address)).to.be.equal(bobLoan);
    //     expect(await VerdeTokenContract.balanceOf(carl.address)).to.be.equal(carlLoan);

    //     await VerdeTokenContract.connect(alice).approve(StakedVerdeContract.target, aliceLoan);
    //     await VerdeTokenContract.connect(bob).approve(StakedVerdeContract.target, bobLoan);
    //     await VerdeTokenContract.connect(carl).approve(StakedVerdeContract.target, carlLoan);

    //     // console.log(await StakedVerdeContract.totalAssets(), await StakedVerdeContract.totalSupply());
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(alice).deposit(aliceLoan, alice.address);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(bob).deposit(bobLoan, bob.address);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await StakedVerdeContract.connect(carl).deposit(carlLoan, carl.address);

    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(aliceLoan);
    //     expect(await StakedVerdeContract.balanceOf(bob.address)).to.be.equal(bobLoan);
    //     expect(await StakedVerdeContract.balanceOf(carl.address)).to.be.equal(carlLoan);

    //     /// --- stVERDE price increase.
    //     // console.log("fees: ", await VerdeTokenContract.balanceOf(TreasuryVaultContract.target));
    //     // console.log("inte: ", initialInterest);
    //     expect(await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)).to.be.equal(initialBorrowFee + interests);
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     // console.log("assets before: ", await StakedVerdeContract.totalAssets());
    //     // console.log("assets sum   : ", (await StakedVerdeContract.totalAssets()) + initialInterest);
    //     // console.log("is auth: ", await TreasuryVaultContract.isAuthorizedBot(alice.address));
    //     await expect(
    //       TreasuryVaultContract.connect(alice).transferVerde(
    //         StakedVerdeContract.target,
    //         initialBorrowFee + interests,
    //       )
    //     ).to.be.revertedWithCustomError(TreasuryVaultContract, "AuthBotUnauthorized");
    //     await TreasuryVaultContract.connect(owner).grantBot(bot.address)

    //     await expect(
    //       TreasuryVaultContract.connect(bot).transferVerde(
    //         StakedVerdeContract.target,
    //         initialBorrowFee + interests,
    //       )
    //     ).to.be.revertedWithCustomError(TreasuryVaultContract, "InvalidFundReceiver");
    //     await TreasuryVaultContract.connect(owner).addValidReceiver(StakedVerdeContract.target)

    //     await TreasuryVaultContract.connect(bot).transferVerde(
    //       StakedVerdeContract.target,
    //       initialBorrowFee + interests,
    //     );
    //     // console.log("assets after : ", await StakedVerdeContract.totalAssets());
    //     expect((await StakedVerdeContract.totalAssets()) - (initialBorrowFee + interests)).to.be.equal(await StakedVerdeContract.totalSupply());

    //     /// --- adding liquidity.
    //     expect(await SwapVerdeContract.getStableLiquidity()).to.be.equal(0);
    //     const aliceUSDTBalance = await USDTTokenContract.balanceOf(alice.address);
    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(aliceLoan);

    //     expect(await StakedVerdeContract.convertToAssets(ethers.parseUnits("10", 6))).to.be.greaterThan(ethers.parseUnits("10", 6));
    //     await USDTTokenContract.connect(alice).approve(StakedStableContract.target, aliceUSDTBalance);

    //     const [previewVerde, swapFee] = await SwapVerdeContract.previewStableToVerde(aliceUSDTBalance);
    //     const beforeSwap = await StakedVerdeContract.previewDeposit(previewVerde);
    //     await StakedStableContract.connect(alice).swapAndStakeVerde(SwapVerdeContract.target, aliceUSDTBalance, 0);
    //     expect(await StakedVerdeContract.balanceOf(alice.address) - aliceLoan).to.be.equal(beforeSwap);
    //     expect(await SwapVerdeContract.getStableLiquidity()).to.be.equal(
    //       aliceUSDTBalance
    //     );

    //     // fees
    //     expect(await VerdeTokenContract.balanceOf(TreasuryVaultContract.target)).to.be.equal(swapFee);
    //   });

    //   it(`[T303]-${index + 1} unstakeAndSwapStable() [initial deposit and withdraw].`, async function () {
    //     const {
    //       USDTTokenContract,
    //       SwapVerdeContract,
    //       TreasuryVaultContract,
    //       StakedVerdeContract,
    //       StakedStableContract,
    //       alice,
    //     } = await loadFixture(fixture);

    //     const aliceUSDTBalance = await USDTTokenContract.balanceOf(alice.address);
    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(0);

    //     /// deposit
    //     expect(await StakedVerdeContract.totalAssets()).to.be.equal(await StakedVerdeContract.totalSupply());
    //     await USDTTokenContract.connect(alice).approve(StakedStableContract.target, aliceUSDTBalance);
    //     await StakedStableContract.connect(alice).swapAndStakeVerde(SwapVerdeContract.target, aliceUSDTBalance, 0);
    //     const [previewVerde, ] = await SwapVerdeContract.previewStableToVerde(aliceUSDTBalance);
    //     expect(await StakedVerdeContract.balanceOf(alice.address)).to.be.equal(
    //       await StakedVerdeContract.previewDeposit(previewVerde)
    //     );

    //     /// withdraw
    //     const aliceSTVERDEAbalance = await StakedVerdeContract.balanceOf(alice.address);
    //     await StakedVerdeContract.connect(alice).approve(StakedStableContract.target, aliceSTVERDEAbalance);
    //     await StakedStableContract.connect(alice).unstakeAndSwapStable(
    //       SwapVerdeContract.target,
    //       aliceSTVERDEAbalance,
    //       0
    //     );
    //   });
    // });

    // describe("Trigger all unit errors", function () {
    //   it(`[T304]-${index + 1} UnknownSwapProtocol() - swapAndStakeVerde and unstakeAndSwapStable [invalid swap protocol].`, async function () {
    //     const {
    //       USDTTokenContract,
    //       InvalidSwapVerdeContract,
    //       StakedStableContract,
    //       alice,
    //     } = await loadFixture(fixture);

    //     const aliceUSDTBalance = await USDTTokenContract.balanceOf(alice.address);

    //     await USDTTokenContract.connect(alice).approve(StakedStableContract.target, aliceUSDTBalance);
    //     await expect(
    //       StakedStableContract.connect(alice).swapAndStakeVerde(InvalidSwapVerdeContract.target, aliceUSDTBalance, 0)
    //     ).to.be.revertedWithCustomError(StakedStableContract, "UnknownSwapProtocol");

    //     await expect(
    //       StakedStableContract.connect(alice).unstakeAndSwapStable(InvalidSwapVerdeContract.target, aliceUSDTBalance, 0)
    //     ).to.be.revertedWithCustomError(StakedStableContract, "UnknownSwapProtocol");
    //   });
    });
  });
});
