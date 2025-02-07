// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import './interfaces/IRewardsManager.sol';
import './interfaces/IStakedIP.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import { Math } from '@openzeppelin/contracts/utils/math/Math.sol';

/// @title RewardsManager for StakedIP
/// @author Meta Pool devs team
/// @dev Receive rewards from the validators and re-stake them into the vault
contract RewardsManager is IRewardsManager, Ownable, ReentrancyGuard {
    using Address for address payable;
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint16 private constant ONE_HUNDRED = 10_000;
    uint16 private constant MAX_REWARDS_FEE = 4_000; // 40%

    address public immutable stakedIP;
    address public treasury;
    uint256 public rewardsFeeBp;

    event SendRewardsAndFees(address indexed _caller, uint256 _rewards, uint256 _treasuryFee);
    event UpdateTreasury(address indexed _caller, address _treasury);
    event UpdateRewardsFee(address indexed _caller, uint256 _rewardsFeeBp);

    error InvalidAddressZero();
    error InvalidRewardsFee();
    error NoRewards();

    modifier checkRewards(uint256 _rewardsFeeBp) {
        require(_rewardsFeeBp <= MAX_REWARDS_FEE, InvalidRewardsFee());
        _;
    }

    constructor(
        address _owner,
        address _stakedIP,
        address _treasury,
        uint256 _rewardsFeeBp
    ) Ownable(_owner) ReentrancyGuard() checkRewards(_rewardsFeeBp) {
        require(_treasury != address(0) && _stakedIP != address(0), InvalidAddressZero());
        stakedIP = _stakedIP;
        treasury = _treasury;
        rewardsFeeBp = _rewardsFeeBp;
    }

    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), InvalidAddressZero());
        treasury = _treasury;

        emit UpdateTreasury(msg.sender, _treasury);
    }

    function updateRewardsFee(uint256 _rewardsFeeBp) external onlyOwner checkRewards(_rewardsFeeBp) {
        rewardsFeeBp = _rewardsFeeBp;

        emit UpdateRewardsFee(msg.sender, _rewardsFeeBp);
    }

    function getManagerAccrued() public view returns (uint256 rewards, uint256 treasuryFee) {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            treasuryFee = balance.mulDiv(rewardsFeeBp, ONE_HUNDRED, Math.Rounding.Floor);
            rewards = balance - treasuryFee;
        }
    }

    /// @notice Send rewards to stIP and claim fees to treasury
    /// @dev Technically safe to be called by anyone
    function sendRewardsAndFees() external nonReentrant {
        (uint256 rewards, uint256 treasuryFee) = getManagerAccrued();
        require(rewards > 0, NoRewards());

        IStakedIP(stakedIP).injectRewards{ value: rewards }();

        if (treasuryFee > 0) payable(treasury).sendValue(treasuryFee);

        emit SendRewardsAndFees(msg.sender, rewards, treasuryFee);
    }
}
