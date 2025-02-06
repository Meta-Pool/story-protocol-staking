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
    uint256 amount;
    uint256 unlockTimestamp;
    address receiver;
}

/// @title Manage withdrawals from validators to users
/// @notice Receive request for withdrawals from StakedIP and allow users to complete the withdrawals once the unlock timestamp is reached
/// @dev As the disassemble of validators is delayed, this contract manage the pending withdraw from users to allow the to complete it once his unlockTimestamp is reached and if the contract has enough IP
contract Withdrawal is OwnableUpgradeable, IWithdrawal {
    using Address for address payable;
    using SafeERC20 for IERC20;

    uint8 public constant MAX_WITHDRAWALS_PER_USER = 4;
    uint32 public constant MAX_VALIDATORS_DISASSEMBLE_TIME = 90 days;

    address payable public stIP;
    address public operator;
    // How much requested withdrawals are pending to complete
    uint256 public totalPendingWithdrawals;
    uint32 public validatorsDisassembleTime;

    mapping(address => WithdrawRequest[MAX_WITHDRAWALS_PER_USER]) private _userPendingWithdrawals;

    event RequestWithdraw(address indexed user, uint256 id, uint256 amount, address receiver, uint256 unlockTimestamp);
    event CompleteWithdraw(address indexed user, uint256 id, uint256 amount, address receiver, uint256 unlockTimestamp);
    event UpdateOperator(address _caller, address _newOperator);

    error StakingUnauthorized(address _caller);
    error NotEnoughIPtoStake(uint256 _requested, uint256 _available);
    error ClaimTooSoon(uint256 timestampUnlock);
    error InvalidDisassembleTime(uint256 valueSent);
    error InvalidRequest();
    error InvalidRequestId(address _user, uint256 _request_id);
    error WithdrawAlreadyCompleted(address _user, uint256 _request_id);
    error UserMaxWithdrawalsReached(address _user);
    error CallerIsNotOperator();

    modifier onlyStaking() {
        require(msg.sender == stIP, StakingUnauthorized(msg.sender));
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, CallerIsNotOperator());
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _owner, address _operator, address payable _stIP) external initializer {
        __Ownable_init(_owner);
        stIP = _stIP;
        _setValidatorsDisassembleTime(14 days);
        updateOperator(_operator);
    }

    receive() external payable {}

    function updateOperator(address _newOperator) public onlyOwner {
        operator = _newOperator;

        emit UpdateOperator(msg.sender, _newOperator);
    }

    function getUserPendingWithdrawals(
        address _account
    ) external view returns (WithdrawRequest[MAX_WITHDRAWALS_PER_USER] memory) {
        return _userPendingWithdrawals[_account];
    }

    /// @notice Set estimated time for validators disassemble
    function setValidatorsDisassembleTime(uint32 _disassembleTime) public onlyOwner {
        _setValidatorsDisassembleTime(_disassembleTime);
    }


    /// @notice Queue IP withdrawal
    /// @dev Multiples withdrawals are accumulative, but will restart the unlock timestamp and override the receiver. Shares used for this request should be already burned in the calling function (StakedIP._withdraw)
    /// @param _amountOut IP amount to withdraw
    /// @param _user Owner of the withdrawal
    function requestWithdraw(uint256 _amountOut, address _user, address _receiver) external onlyStaking {
        if (_amountOut == 0) revert InvalidRequest();

        uint256 unlockTimestamp = block.timestamp + validatorsDisassembleTime;
        uint256 request_id = _findEmptySlot(_user);

        _userPendingWithdrawals[_user][request_id] = WithdrawRequest({
            amount: _amountOut,
            unlockTimestamp: unlockTimestamp,
            receiver: _receiver
        });
        totalPendingWithdrawals += _amountOut;

        emit RequestWithdraw(_user, request_id, _amountOut, _receiver, unlockTimestamp);
    }

    /// @notice Process pending withdrawal if there's enough IP
    /// @param _request_id Position of the withdrawal in the _userPendingWithdrawals array
    function completeWithdraw(uint256 _request_id) external {
        WithdrawRequest memory _pendingUserWithdraw = _userPendingWithdrawals[msg.sender][_request_id];

        if (_pendingUserWithdraw.amount == 0) {
            revert InvalidRequestId(msg.sender, _request_id);
        }

        if (block.timestamp < _pendingUserWithdraw.unlockTimestamp) {
            revert ClaimTooSoon(_pendingUserWithdraw.unlockTimestamp);
        }

        delete _userPendingWithdrawals[msg.sender][_request_id];
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
    /// @dev As the validators with less than 1024 IP will be fully disassembled,
    /// the contract can have more IP than the needed for withdrawals.
    /// So the Staking can take this IP and send it again to validators. This shouldn't mint new stIP
    function sendIPToRestake(uint256 _amount) external onlyOperator {
        if (address(this).balance <= totalPendingWithdrawals) revert NotEnoughIPtoStake(_amount, 0);

        uint256 ipRemaining = address(this).balance - totalPendingWithdrawals;

        if (_amount > ipRemaining) revert NotEnoughIPtoStake(_amount, ipRemaining);

        stIP.sendValue(_amount);
    }

    function _setValidatorsDisassembleTime(uint32 _disassembleTime) private {
        require(_disassembleTime <= MAX_VALIDATORS_DISASSEMBLE_TIME, InvalidDisassembleTime(_disassembleTime));
        validatorsDisassembleTime = _disassembleTime;
    }

    function _findEmptySlot(address _user) private view returns (uint256) {
        for (uint256 i = 0; i < MAX_WITHDRAWALS_PER_USER; i++) {
            if (_userPendingWithdrawals[_user][i].amount == 0) return i;
        }
        revert UserMaxWithdrawalsReached(_user);
    }
}
