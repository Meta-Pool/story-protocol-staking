// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './interfaces/IRewardsManager.sol';
import './interfaces/IStakedIP.sol';

/// @dev Receive rewards from the validators and re-stake them into the vault
contract RewardsManager is IRewardsManager, Ownable, ReentrancyGuard {

    using Address for address payable;
    using SafeERC20 for IERC20;

    uint16 private constant ONE_HUNDRED = 10_000;

    address public immutable stakedIP;
    address public treasury;
    uint256 public rewardsFeeBp;

    event SendRewardsAndFees(address indexed _caller, uint256 _rewards, uint256 _treasuryFee);
    event UpdateTreasury(address indexed _caller, address _treasury);

    error InvalidAddressZero();

    constructor(
        address _owner,
        address _stakedIP,
        uint256 _rewardsFeeBp,
        address _treasury
    ) Ownable(_owner) ReentrancyGuard() {
        stakedIP = _stakedIP;
        treasury = _treasury;
        rewardsFeeBp = _rewardsFeeBp;
    }

    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), InvalidAddressZero());
        treasury = _treasury;

        emit UpdateTreasury(msg.sender, _treasury);
    }

    function getManagerAccrued() public view returns (uint256 rewards, uint256 treasuryFee) {
        uint256 balance = address(this).balance;
        treasuryFee = (balance * rewardsFeeBp) / ONE_HUNDRED;
        rewards = balance - treasuryFee;
    }

    /// @notice Send rewards to stIP and claim fees to treasury
    /// @dev Technically safe to be called by anyone
    function sendRewardsAndFees() external nonReentrant {
        (uint256 rewards, uint256 treasuryFee) = getManagerAccrued();

        if (rewards > 0) IStakedIP(stakedIP).injectRewards{ value: rewards }();
        if (treasuryFee > 0) payable(treasury).sendValue(treasuryFee);

        emit SendRewardsAndFees(msg.sender, rewards, treasuryFee);
    }
}
