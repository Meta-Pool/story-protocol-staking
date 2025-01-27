// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './StakedIP.sol';
import './interfaces/IWithdrawal.sol';

struct WithdrawRequest {
  uint amount;
  uint unlockTimestamp;
  address receiver;
}

/// @title Manage withdrawals from validators to users
/// @notice Receive request for withdrawals from StakedIP and allow users to complete the withdrawals once the epoch is reached
/// @dev As the disassemble of validators is delayed, this contract manage the pending withdraw from users to allow the to complet it once his unlockTimestamp is reached and if the contract has enough IP
// The epochs are of one week
contract Withdrawal is OwnableUpgradeable, IWithdrawal {
  using Address for address payable;
  using SafeERC20 for IERC20;

  address payable public stIP;
  // How much we have pending to unstake to fulfill the withdrawals
  uint public totalPendingWithdrawals;
  mapping(address => WithdrawRequest) public pendingWithdraws;
  uint8 public withdrawalsStartEpoch;
  uint32 public constant MAX_VALIDATORS_DISASSEMBLE_TIME = 90 days;
  uint32 public validatorsDisassembleTime;

  event RequestWithdraw(address indexed caller, uint amount, address receiver, uint unlockTimestamp);
  event CompleteWithdraw(address indexed caller, uint amount, address receiver, uint unlockTimestamp);

  error Unauthorized(address _caller, address _authorized);
  error EpochNotReached(uint _currentEpoch, uint _unlockEpoch);
  error UserDoesntHavePendingWithdraw(address _user);
  error NotEnoughIPtoStake(uint _requested, uint _available);
  error WithdrawalsNotStarted(uint _currentEpoch, uint _startEpoch);
  error ClaimTooSoon(uint timestampUnlock);
  error InvalidConfig(uint valueSent, uint maxValue);

  modifier onlyStaking() {
    if (msg.sender != stIP) revert Unauthorized(msg.sender, stIP);
    _;
  }

  receive() external payable {}

  function initialize(address payable _stIP) external initializer {
    __Ownable_init(msg.sender);
    stIP = _stIP;
    setValidatorsDisassembleTime(14 days);
  }

  /// @notice Set estimated time for validators disassemble
  function setValidatorsDisassembleTime(uint32 _disassembleTime) public onlyOwner {
    if (_disassembleTime > MAX_VALIDATORS_DISASSEMBLE_TIME)
      revert InvalidConfig(_disassembleTime, MAX_VALIDATORS_DISASSEMBLE_TIME);
    validatorsDisassembleTime = _disassembleTime;
  }

  /// @notice Queue IP withdrawal
  /// @dev Multiples withdrawals are accumulative, but will restart the unlock timestamp and override the receiver. Shares used for this request should be already burned in the calling function (StakedIP._withdraw)
  /// @param _amountOut IP amount to withdraw
  /// @param _user Owner of the withdrawal
  function requestWithdraw(uint _amountOut, address _user, address _receiver) external onlyStaking {
    uint unlockTimestamp = block.timestamp + validatorsDisassembleTime;

    pendingWithdraws[_user] = WithdrawRequest({
      amount: pendingWithdraws[_user].amount + _amountOut,
      unlockTimestamp: unlockTimestamp,
      receiver: _receiver
    });
    totalPendingWithdrawals += _amountOut;

    emit RequestWithdraw(_user, _amountOut, _receiver, unlockTimestamp);
  }

  /// @notice Process pending withdrawal if there's enough IP
  function completeWithdraw() external {
    WithdrawRequest memory _pendingUserWithdraw = pendingWithdraws[msg.sender];

    if (_pendingUserWithdraw.amount == 0) revert UserDoesntHavePendingWithdraw(msg.sender);

    if (block.timestamp < _pendingUserWithdraw.unlockTimestamp)
      revert ClaimTooSoon(_pendingUserWithdraw.unlockTimestamp);

    delete pendingWithdraws[msg.sender];
    payable(_pendingUserWithdraw.receiver).sendValue(_pendingUserWithdraw.amount);

    totalPendingWithdrawals -= _pendingUserWithdraw.amount;

    emit CompleteWithdraw(
      msg.sender,
      _pendingUserWithdraw.amount,
      _pendingUserWithdraw.receiver,
      _pendingUserWithdraw.unlockTimestamp
    );
  }

  /// @notice Send IP _amount to Staking
  /// @dev As the validators with less than 1024 IP will be fully disassembled, the contract can have more IP than the needed for withdrawals. So the Staking can take this IP and send it again to validators. This shouldn't mint new stIP
  function sendIPToRestake(uint _amount) external onlyStaking {
    if (address(this).balance <= totalPendingWithdrawals) revert NotEnoughIPtoStake(_amount, 0);

    uint ipRemaining = address(this).balance - totalPendingWithdrawals;

    if (_amount > ipRemaining) revert NotEnoughIPtoStake(_amount, ipRemaining);

    stIP.sendValue(_amount);
  }
}
