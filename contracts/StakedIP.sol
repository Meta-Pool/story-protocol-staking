// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import './interfaces/IRewardsManager.sol';
import './interfaces/IStakedIP.sol';
import './interfaces/IWIP.sol';
import './interfaces/IWithdrawal.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import { IIPTokenStakingFull as IIPTokenStaking } from './interfaces/story/IIPTokenStakingFull.sol';

struct Validator {
    bytes cmpPubkey; // 33 bytes compressed secp256k1 public key
    uint16 targetStakePercent;
}

/// @title Meta Pool stIP 🌒 vault contract.
/// @author Meta Pool devs team
/// @notice [FullyOperational] When NOT fully operational, users cannot: 1) mint, 2) deposit, 3) withdraw nor 4) redeem.
contract StakedIP is Initializable, ERC4626Upgradeable, OwnableUpgradeable, IStakedIP {
    using Address for address payable;
    using SafeERC20 for IERC20;

    /// *************
    /// * Constants *
    /// *************

    /// @dev Absolute minimum deposit amount. Cannot be lower.
    uint256 constant private MIN_DEPOSIT_AMOUNT = 1 gwei;

    /// @dev The total sum (100%) of the validators percent as Basis Points.
    uint16 private constant ONE_HUNDRED = 10_000;
    uint16 private constant MAX_VALIDATORS = 10;

    /// *****************
    /// * Storage slots *
    /// *****************

    uint256 public minDepositAmount;
    uint256 public totalUnderlying;

    IIPTokenStaking public ipTokenStaking;
    address public operator;
    address public rewardsManager;
    address public withdrawal;

    bool public fullyOperational;
    bool private setupExecuted;

    /// @notice Target 🎯 values always sum ONE_HUNDRED, percentage on each validator.
    /// By definition, the following two arrays must be the same size ALL the time.
    /// The size must be greater than 0 and less than, or equal, to MAX_VALIDATORS.
    /// `validators` aka Starting Rotation 🏟️
    uint256 public validatorsLength;
    Validator[MAX_VALIDATORS] private _validators;
    mapping(bytes32 => bool) private _validatorExists;

    /// *******************
    /// * Events & errors *
    /// *******************

    event CoverWithdrawals(address _caller, uint256 _amount);
    event InsertValidator(bytes _validator);
    event RemoveValidator(bytes _validator);
    event ReplaceValidator(bytes _oldValidatorCmpPubkey, bytes _newValidatorCmpPubkey);
    event Stake(address _caller, bytes indexed _validator, uint256 _delegation_id, uint256 _amount, bytes _extraData);
    event Unstake(address _caller, bytes indexed _validator, uint256 _amount, uint256 _delegation_id, bytes _extraData);
    event UpdateContractOperation(address _caller, bool _newValue);
    event UpdateMinDepositAmount(address _caller, uint256 _new);
    event UpdateOperator(address _caller, address _newOperator);
    event UpdateRewardsManager(address _caller, address _newRewardsManager);
    event UpdateValidatorTargets(address _sender);
    event UpdateWithdrawal(address _caller, address _newWithdrawal);

    error ArraySizeMismatch();
    error HasStaking();
    error InvalidDepositSender(address _caller);
    error InvalidIPFee();
    error InvalidZeroAddress();
    error InvalidZeroAmount();
    error LessThanMinDeposit();
    error MaxValidatorsExceeded();
    error NotFullyOperational();
    error OperatorUnauthorized();
    error SetupAlreadyExecuted();
    error SetupInvalidIPValue();
    error ShouldBeOneHundred(uint256 _sumOfPercentages);
    error ValidatorAlreadyListed(bytes _invalidValidator);
    error ValidatorHasTargetPercent(Validator _validator);
    error ValidatorNotFount(bytes _validator);
    error ValidatorNotListed(bytes _validatorCmpPubkey);
    error ValidatorsEmptyList();

    modifier onlyFullyOperational() {
        require(fullyOperational, NotFullyOperational());
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, OperatorUnauthorized());
        _;
    }

    modifier checkStakingOperationsFee() {
        require (msg.value == ipTokenStaking.fee(), InvalidIPFee());
        _;
    }

    modifier checkValidatorExists(bytes calldata _validatorCmpPubkey) {
        require(isValidatorListed(_validatorCmpPubkey), ValidatorNotListed(_validatorCmpPubkey));
        _;
    }

    modifier checkDuplicatedValidator(bytes memory _validatorCmpPubkey) {
        require(!isValidatorListed(_validatorCmpPubkey), ValidatorAlreadyListed(_validatorCmpPubkey));
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address _operator,
        IIPTokenStaking _ipTokenStaking,
        IERC20 _asset,
        string memory _stIPName,
        string memory _stIPSymbol,
        uint256 _minDepositAmount,
        bytes[] calldata _validatorsPubkey,
        uint16[] calldata _validatorsStakePercent
    ) public initializer {
        require(address(_ipTokenStaking) != address(0) && address(_asset) != address(0), InvalidZeroAddress());
        require(_validatorsPubkey.length > 0, ValidatorsEmptyList());

        // First allow deployer to run the setup.
        __Ownable_init(msg.sender);
        __ERC4626_init(_asset);
        __ERC20_init(_stIPName, _stIPSymbol);

        updateOperator(_operator);
        updateMinDepositAmount(_minDepositAmount);
        ipTokenStaking = _ipTokenStaking;

        for (uint256 i = 0; i < _validatorsPubkey.length; ++i) {
            _insertValidator(_validatorsPubkey[i]);
        }
        _updateValidatorsTarget(_validatorsStakePercent);
    }

    /// @notice Setup contracts and makes first stake
    /// @dev To set withdrawal and reward addresses into Story is required to have at least one stake.
    /// This function run only once. Separated from initialize as oz does not allow to call as payable.
    /// https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/953
    function setupStaking(
        address _owner,
        address _withdrawal,
        address _rewardsManager,
        bytes calldata _validatorCmpPubkey,
        IIPTokenStaking.StakingPeriod _period
    ) external payable onlyOwner {
        require(
            _owner != address(0) && _withdrawal != address(0) && _rewardsManager != address(0),
            InvalidZeroAddress()
        );
        require(!setupExecuted, SetupAlreadyExecuted());
        require(totalUnderlying == 0, HasStaking());
        require(isValidatorListed(_validatorCmpPubkey), ValidatorNotListed(_validatorCmpPubkey));

        uint256 fee = ipTokenStaking.fee();
        uint256 minStake = ipTokenStaking.minStakeAmount();
        require(msg.value == (2 * fee) + minStake, SetupInvalidIPValue());

        fullyOperational = true;

        rewardsManager = _rewardsManager;

        this.depositIP{ value: minStake }(msg.sender);

        // Temp operator permission for first stake
        address _operator = operator;
        operator = address(this);
        this.stake(_validatorCmpPubkey, minStake, _period, "");
        operator = _operator;

        // First stake and then set addresses bcs Story requires to have some staking to set addresses
        withdrawal = _withdrawal;
        ipTokenStaking.setWithdrawalAddress{ value: fee }(_withdrawal);

        rewardsManager = _rewardsManager;
        ipTokenStaking.setRewardsAddress{ value: fee }(_rewardsManager);

        transferOwnership(_owner);
        setupExecuted = true;
    }

    /// @dev Deposit in case a user sends tokens directly to the contract
    /// Exclude in case of asset for unwrapped process and withdrawal for sendIPToRestake
    receive() external payable {
        if (msg.sender != asset() && msg.sender != withdrawal) {
            depositIP(msg.sender);
        }
    }

    /// *********
    /// * Admin *
    /// *********

    function updateWithdrawal(address _withdrawal) public payable onlyOwner checkStakingOperationsFee {
        require(_withdrawal != address(0), InvalidZeroAddress());
        withdrawal = _withdrawal;
        ipTokenStaking.setWithdrawalAddress{ value: msg.value }(_withdrawal);

        emit UpdateWithdrawal(msg.sender, _withdrawal);
    }

    function updateRewardsManager(address _rewardsManager) public payable onlyOwner checkStakingOperationsFee {
        require(_rewardsManager != address(0), InvalidZeroAddress());
        rewardsManager = _rewardsManager;
        ipTokenStaking.setRewardsAddress{ value: msg.value }(_rewardsManager);

        emit UpdateRewardsManager(msg.sender, _rewardsManager);
    }

    /// @notice Use in case of emergency 🦺.
    function toggleContractOperation() public onlyOwner {
        fullyOperational = !fullyOperational;

        emit UpdateContractOperation(msg.sender, fullyOperational);
    }

    function updateMinDepositAmount(uint256 _amount) public onlyOwner {
        require(_amount >= MIN_DEPOSIT_AMOUNT, LessThanMinDeposit());
        minDepositAmount = _amount;

        emit UpdateMinDepositAmount(msg.sender, _amount);
    }

    function updateOperator(address _newOperator) public onlyOwner {
        require(_newOperator != address(0), InvalidZeroAddress());
        operator = _newOperator;

        emit UpdateOperator(msg.sender, _newOperator);
    }

    /// @notice Delete validators in bulk
    /// @dev The validators must have zero target percent. Call updateValidatorsTarget() before
    function bulkRemoveValidators(bytes[] memory _validatorsCmpPubkey) external onlyOwner {
        for (uint256 i = 0; i < _validatorsCmpPubkey.length; ++i) {
            _removeValidator(_validatorsCmpPubkey[i]);
        }
    }

    /// @notice Insert validators in bul with zero target percent
    function bulkInsertValidators(bytes[] memory _validatorsCmpPubkey) external onlyOwner {
        for (uint256 i = 0; i < _validatorsCmpPubkey.length; ++i) {
            _insertValidator(_validatorsCmpPubkey[i]);
        }
    }

    /// Update all the validators target stakes percent
    function updateValidatorsTarget(uint16[] calldata _targetStakesPercent) external onlyOwner {
        _updateValidatorsTarget(_targetStakesPercent);
    }

    /// @notice Replace one validator maintaining the target percent
    function replaceOneValidator(
        bytes memory _oldValidatorCmpPubkey,
        bytes memory _newValidatorCmpPubkey
    ) external onlyOwner checkDuplicatedValidator(_newValidatorCmpPubkey) {
        uint256 _index = getValidatorIndex(_oldValidatorCmpPubkey);
        _validators[_index].cmpPubkey = _newValidatorCmpPubkey;

        _validatorExists[keccak256(_oldValidatorCmpPubkey)] = false;
        _validatorExists[keccak256(_newValidatorCmpPubkey)] = true;

        emit ReplaceValidator(_oldValidatorCmpPubkey, _newValidatorCmpPubkey);
    }

    /// ************
    /// * Operator *
    /// ************

    /// @dev If there are pending withdrawals, new deposits will be used to cover them to avoid unstaking
    function coverWithdrawals(uint256 _assets) external onlyOperator {
        payable(withdrawal).sendValue(_assets);
        emit CoverWithdrawals(msg.sender, _assets);
    }

    /// @notice Operator function to stake IP into the validator
    /// @param _validatorCmpPubkey Validator uncompressed public key
    /// @param _amount Amount of IP to stake
    /// @param _period Enum staking period (flexible, short, medium, long)
    /// @param _extraData Additional data for the staking contract
    /// @return delegation_id The delegation id of the staked IP. Always 0 for flexible staking. Unique id for fixed staking
    function stake(
        bytes calldata _validatorCmpPubkey,
        uint256 _amount,
        IIPTokenStaking.StakingPeriod _period,
        bytes calldata _extraData
    ) external onlyFullyOperational onlyOperator checkValidatorExists(_validatorCmpPubkey) returns (uint256 delegation_id) {
        delegation_id = ipTokenStaking.stake{ value: _amount }(
            _validatorCmpPubkey,
            _period,
            _extraData
        );

        emit Stake(msg.sender, _validatorCmpPubkey, delegation_id, _amount, _extraData);
    }

    /// @notice Operator function to unstake IP from the validator
    /// @param _validatorCmpPubkey Validator uncompressed public key
    /// @param _amount Amount of IP to unstake
    /// @param _delegation_id The delegation id of the staked IP. Always 0 for flexible staking
    /// @param _extraData Additional data for the staking contract
    function unstake(
        bytes calldata _validatorCmpPubkey,
        uint256 _amount,
        uint256 _delegation_id,
        bytes calldata _extraData
    )
        external
        payable
        onlyFullyOperational
        onlyOperator
        checkStakingOperationsFee
        checkValidatorExists(_validatorCmpPubkey)
    {
        ipTokenStaking.unstake{ value: msg.value }(
            _validatorCmpPubkey,
            _delegation_id,
            _amount,
            _extraData
        );

        emit Unstake(msg.sender, _validatorCmpPubkey, _amount, _delegation_id, _extraData);
    }

    /// @notice Operator function to redelegate IP from one validator to another
    /// @param _oldValidatorCmpPubkey Old validator uncompressed public key
    /// @param _newValidatorCmpPubkey New validator uncompressed public key
    /// @param _amount Amount of IP to redelegate
    /// @param _delegation_id The delegation id of the staked IP. Always 0 for flexible staking
    function redelegate(
        bytes calldata _oldValidatorCmpPubkey,
        bytes calldata _newValidatorCmpPubkey,
        uint256 _amount,
        uint256 _delegation_id
    )
        external
        payable
        onlyFullyOperational
        onlyOperator
        checkStakingOperationsFee
        checkValidatorExists(_newValidatorCmpPubkey)
    {
        ipTokenStaking.redelegate{ value: msg.value }(
            _oldValidatorCmpPubkey,
            _newValidatorCmpPubkey,
            _delegation_id,
            _amount
        );
    }

    /// ******************
    /// * View functions *
    /// ******************

    function getStIPPrice() public view returns (uint256) {
        return convertToAssets(1 ether);
    }

    /// @dev Assets increases as rewards are received by rewardsManager and later re-staked burning his shares
    function totalAssets() public view override returns (uint256) {
        (uint256 rewards, ) = IRewardsManager(rewardsManager).getManagerAccrued();
        return totalUnderlying + rewards;
    }

    function getValidators() external view returns (Validator[MAX_VALIDATORS] memory) {
        return _validators;
    }

    function isValidatorListed(bytes memory _validatorCmpPubkey) public view returns (bool) {
        return _validatorExists[keccak256(_validatorCmpPubkey)];
    }

    /// @notice Redistribute the total amount of IP into the target percent
    function redistribute(uint256 _totalAmount) external view returns (uint256[] memory) {
        Validator[MAX_VALIDATORS] memory validators = _validators;
        uint256[] memory stakes = new uint256[](validatorsLength);

        /// @dev In case of rounding errors, do not add the leftovers to a 0 percent validator
        uint256 _indexOfNotZeroPercentValidator;
        uint256 totalDistributed = 0; // Should equal _totalQ.
        for (uint256 i = 0; i < validatorsLength; ++i) {
            if (validators[i].targetStakePercent == 0) continue;
            _indexOfNotZeroPercentValidator = i;

            uint256 delegateAmount = ((_totalAmount * uint256(validators[i].targetStakePercent)) /
                uint256(ONE_HUNDRED));

            stakes[i] = delegateAmount;
            totalDistributed += delegateAmount;
        }

        // Handle rounding errors by adding leftovers to the last distribution
        if (totalDistributed < _totalAmount) {
            stakes[_indexOfNotZeroPercentValidator] += _totalAmount - totalDistributed;
        }

        return stakes;
    }

    function getValidatorIndex(bytes memory _validatorCmpPubkey) public view returns (uint256) {
        Validator[MAX_VALIDATORS] memory validators = _validators;

        bytes32 _validatorPubkeyHash = keccak256(_validatorCmpPubkey);
        for (uint256 i = 0; i < validators.length; ++i) {
            if (keccak256(validators[i].cmpPubkey) == _validatorPubkeyHash) {
                return i;
            }
        }

        revert ValidatorNotFount(_validatorCmpPubkey);
    }

    /// *************************
    /// * Processing Rewards 💎 *
    /// *************************

    /// todo: not everybody should be able to inject rewards
    function injectRewards() external payable {
        require(msg.value >= minDepositAmount, LessThanMinDeposit());
        totalUnderlying += msg.value;
    }

    /// *********************
    /// * ERC4626 functions *
    /// *********************

    /// @notice Used to deposit IP tokens (native asset).
    function depositIP(address _receiver) public payable returns (uint256) {
        uint256 shares = previewDeposit(msg.value);

        _deposit(msg.sender, _receiver, msg.value, shares);

        return shares;
    }

    function deposit(uint256 _assets, address _receiver) public override returns (uint256) {
        _transferAndUnwrap(msg.sender, _assets);

        uint256 shares = previewDeposit(_assets);
        _deposit(msg.sender, _receiver, _assets, shares);

        return shares;
    }

    /// @param _shares are minted, but user have to pay in Q tokens.
    function mintIP(uint256 _shares, address _receiver) external payable returns (uint256) {
        uint256 assets = previewMint(_shares);
        
        _deposit(msg.sender, _receiver, assets, _shares);

        // Return change to the caller.
        uint256 change = msg.value - assets;
        if (change > 0) {
            payable(msg.sender).transfer(change);
        }

        return assets;
    }

    function mint(uint256 _shares, address _receiver) public override returns (uint256) {
        uint256 assets = previewMint(_shares);

        _transferAndUnwrap(msg.sender, assets);
        _deposit(msg.sender, _receiver, assets, _shares);

        return assets;
    }

    /// ************
    /// * Internal *
    /// ************

    /// @dev For safety _deposit makes all the assets and shares checks
    function _deposit(
        address _caller,
        address _receiver,
        uint256 _assets,
        uint256 _shares
    ) internal override onlyFullyOperational {
        require(_shares > 0, InvalidZeroAmount());
        require(_assets >= minDepositAmount, LessThanMinDeposit());

        _mint(_receiver, _shares);
        totalUnderlying += _assets;

        emit Deposit(_caller, _receiver, _assets, _shares);
    }

    function _withdraw(
        address _caller,
        address _receiver,
        address _owner,
        uint256 _assets,
        uint256 _shares
    ) internal override onlyFullyOperational {
        if (_shares == 0) revert InvalidZeroAmount();
        if (_caller != _owner) _spendAllowance(_owner, _caller, _shares);

        _burn(_owner, _shares);
        totalUnderlying -= _assets;

        IWithdrawal(withdrawal).requestWithdraw(_assets, _caller, _receiver);

        emit Withdraw(msg.sender, _receiver, _owner, _shares, _assets);
    }

    /// ***********
    /// * Private *
    /// ***********

    function _transferAndUnwrap(address _from, uint256 _amount) private {
        address asset = asset();
        IERC20(asset).safeTransferFrom(_from, address(this), _amount);
        IWIP(asset).withdraw(_amount);
    }

    function _updateValidatorsTarget(uint16[] calldata _targetStakesPercent) private {
        uint256 _validatorsLength = validatorsLength;
        require(_targetStakesPercent.length == _validatorsLength, ArraySizeMismatch());

        Validator[MAX_VALIDATORS] memory validators = _validators;

        uint16 stakeSum;
        for (uint256 i = 0; i < _validatorsLength; ++i) {
            validators[i].targetStakePercent = _targetStakesPercent[i];
            stakeSum += _targetStakesPercent[i];
        }

        require(stakeSum == ONE_HUNDRED, ShouldBeOneHundred(stakeSum));
        _validators = validators;

        emit UpdateValidatorTargets(msg.sender);
    }

    function _removeValidator(bytes memory _validatorCmpPubkey) private {
        uint256 _validatorsLength = validatorsLength;

        // The final validators array cannot be empty. Once initialized, it should be 
        // theoretically impossible for it to become empty.
        require(_validatorsLength > 1, ValidatorsEmptyList());

        uint256 _index = getValidatorIndex(_validatorCmpPubkey);
        Validator memory validator = _validators[_index];

        require(validator.targetStakePercent == 0, ValidatorHasTargetPercent(validator));

        if (_index != _validatorsLength - 1) {
            // Replace the element at the index with the last element in the array
            _validators[_index] = _validators[_validatorsLength - 1];
            delete _validators[_validatorsLength - 1];
        } else {
            // If the element is the last one, just remove it
            delete _validators[_index];
        }

        _validatorExists[keccak256(_validatorCmpPubkey)] = false;
        validatorsLength--;

        emit RemoveValidator(_validatorCmpPubkey);
    }

    function _insertValidator(
        bytes memory _validatorCmpPubkey
    ) private checkDuplicatedValidator(_validatorCmpPubkey) {
        uint256 _validatorsLength = validatorsLength;

        /// notice how it needs to be at least one less than the MAX_VALIDATORS.
        require(_validatorsLength < MAX_VALIDATORS, MaxValidatorsExceeded());

        /// updating storage.
        _validatorExists[keccak256(_validatorCmpPubkey)] = true;
        _validators[_validatorsLength].cmpPubkey = _validatorCmpPubkey;
        validatorsLength++;

        emit InsertValidator(_validatorCmpPubkey);
    }
}
