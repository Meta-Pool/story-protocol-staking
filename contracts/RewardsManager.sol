// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IRewardsManager.sol';
import './interfaces/IStakedIP.sol';

/// @dev Receive rewards from the validators and re-stake them into the vault
contract RewardsManager is Initializable, IRewardsManager, OwnableUpgradeable {
    using Address for address payable;
    using SafeERC20 for IERC20;

    uint16 private constant ONE_HUNDRED = 10_000;

    address public stakedIP;
    address public treasury;
    uint public rewardsFeeBp;

    event SendRewards(address _caller, uint _amount);
    event SendFees(address _caller, uint _amount);
    event UpdateTreasury(address _caller, address _treasury);

    function initialize(address payable _stakedIP, uint _rewardsFeeBp, address _treasury) public initializer {
        __Ownable_init(msg.sender);
        stakedIP = _stakedIP;
        treasury = _treasury;
        rewardsFeeBp = _rewardsFeeBp;
    }

    function updateTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit UpdateTreasury(msg.sender, _treasury);
    }

    function getManagerAccrued() public view returns (uint rewards, uint treasuryFee) {
        uint balance = address(this).balance;
        treasuryFee = (balance * rewardsFeeBp) / ONE_HUNDRED;
        rewards = balance - treasuryFee;
    }

    /// @notice Send rewards to stIP and claim fees to treasury
    /// @dev Techincally safe to be called by anyone
    function sendRewardsAndFees() external {
        (uint rewards, uint treasuryFee) = getManagerAccrued();

        IStakedIP(stakedIP).injectRewards{ value: rewards }();
        payable(treasury).sendValue(treasuryFee);

        emit SendRewards(msg.sender, rewards);
        emit SendFees(msg.sender, treasuryFee);
    }
}
