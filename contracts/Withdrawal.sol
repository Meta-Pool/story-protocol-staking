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
/// @notice Receive request for withdrawals from StakedIP and allow users to complete the withdrawals once the unlock timestamp is reached
/// @dev As the disassemble of validators is delayed, this contract manage the pending withdraw from users to allow the to complet it once his unlockTimestamp is reached and if the contract has enough IP

contract Withdrawal is OwnableUpgradeable, IWithdrawal {
    using Address for address payable;
    using SafeERC20 for IERC20;

    address payable public stIP;
    // How much requested withdrawals are pending to complete
    uint public totalPendingWithdrawals;
    uint8 public constant MAX_WITHDRAWALS_PER_USER = 4;
    uint32 public constant MAX_VALIDATORS_DISASSEMBLE_TIME = 90 days;
    uint32 public validatorsDisassembleTime;
    mapping(address => WithdrawRequest[MAX_WITHDRAWALS_PER_USER]) public userPendingWithdrawals;

    event RequestWithdraw(address indexed user, uint id, uint amount, address receiver, uint unlockTimestamp);
    event CompleteWithdraw(address indexed user, uint id, uint amount, address receiver, uint unlockTimestamp);

    error Unauthorized(address _caller, address _authorized);
    error NotEnoughIPtoStake(uint _requested, uint _available);
    error ClaimTooSoon(uint timestampUnlock);
    error InvalidDisassembleTime(uint valueSent, uint maxValue);
    error InvalidRequest();
    error InvalidRequestId(address _user, uint _request_id);
    error WithdrawAlreadeCompleted(address _user, uint _request_id);
    error UserMaxWithdrawalsReached(address _user);

    constructor() { _disableInitializers(); }

    function initialize(address payable _stIP) external initializer {
        __Ownable_init(msg.sender);
        stIP = _stIP;
        setValidatorsDisassembleTime(14 days);
    }

    receive() external payable {}

    modifier onlyStaking() {
        if (msg.sender != stIP) revert Unauthorized(msg.sender, stIP);
        _;
    }

    function _findEmptySlot(address _user) internal view returns (uint) {
        for (uint i = 0; i < MAX_WITHDRAWALS_PER_USER; i++) {
            if (userPendingWithdrawals[_user][i].amount == 0) return i;
        }
        revert UserMaxWithdrawalsReached(_user);
    }

    /// @notice Set estimated time for validators disassemble
    function setValidatorsDisassembleTime(uint32 _disassembleTime) public onlyOwner {
        if (_disassembleTime > MAX_VALIDATORS_DISASSEMBLE_TIME)
            revert InvalidDisassembleTime(_disassembleTime, MAX_VALIDATORS_DISASSEMBLE_TIME);
        validatorsDisassembleTime = _disassembleTime;
    }

    /// @notice Queue IP withdrawal
    /// @dev Multiples withdrawals are accumulative, but will restart the unlock timestamp and override the receiver. Shares used for this request should be already burned in the calling function (StakedIP._withdraw)
    /// @param _amountOut IP amount to withdraw
    /// @param _user Owner of the withdrawal
    function requestWithdraw(uint _amountOut, address _user, address _receiver) external onlyStaking {
        if (_amountOut == 0) revert InvalidRequest();

        uint unlockTimestamp = block.timestamp + validatorsDisassembleTime;
        uint request_id = _findEmptySlot(_user);

        userPendingWithdrawals[_user][request_id] = WithdrawRequest({
            amount: _amountOut,
            unlockTimestamp: unlockTimestamp,
            receiver: _receiver
        });
        totalPendingWithdrawals += _amountOut;

        emit RequestWithdraw(_user, request_id, _amountOut, _receiver, unlockTimestamp);
    }

    /// @notice Process pending withdrawal if there's enough IP
    /// @param _request_id Position of the withdrawal in the userPendingWithdrawals array
    function completeWithdraw(uint _request_id) external {
        WithdrawRequest memory _pendingUserWithdraw = userPendingWithdrawals[msg.sender][_request_id];

        if (_pendingUserWithdraw.amount == 0) {
            revert InvalidRequestId(msg.sender, _request_id);
        }

        if (block.timestamp < _pendingUserWithdraw.unlockTimestamp) {
            revert ClaimTooSoon(_pendingUserWithdraw.unlockTimestamp);
        }

        delete userPendingWithdrawals[msg.sender][_request_id];
        totalPendingWithdrawals -= _pendingUserWithdraw.amount;

        payable(_pendingUserWithdraw.receiver).sendValue(_pendingUserWithdraw.amount);

        emit CompleteWithdraw(
            msg.sender,
            _request_id,
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
