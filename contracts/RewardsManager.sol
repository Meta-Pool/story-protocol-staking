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
    uint public rewardsFeeBp;

    event SendRewards(address _caller, uint _amount);
    event SendFees(address _caller, uint _amount);
    event UpdateTreasury(address _caller, address _treasury);

    error InvalidAddressZero();

    constructor(
        address _owner,
        address _stakedIP,
        uint _rewardsFeeBp,
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

    function getManagerAccrued() public view returns (uint rewards, uint treasuryFee) {
        uint balance = address(this).balance;
        treasuryFee = (balance * rewardsFeeBp) / ONE_HUNDRED;
        rewards = balance - treasuryFee;
    }

    /// @notice Send rewards to stIP and claim fees to treasury
    /// @dev Technically safe to be called by anyone
    function sendRewardsAndFees() external nonReentrant {
        (uint rewards, uint treasuryFee) = getManagerAccrued();

        IStakedIP(stakedIP).injectRewards{ value: rewards }();
        payable(treasury).sendValue(treasuryFee);

        emit SendRewards(msg.sender, rewards);
        emit SendFees(msg.sender, treasuryFee);
    }
}
