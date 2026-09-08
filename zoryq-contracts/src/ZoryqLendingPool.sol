// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZoryqERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Testnet-only overcollateralized lending market for native ZQ collateral and zUSD debt.
/// @dev V1 intentionally uses a fixed 1 ZQ = 1 zUSD test oracle and 50% max LTV.
///      It has no monetary-value promise and MUST NOT be used with real assets.
contract ZoryqLendingPool {
    IZoryqERC20 public immutable zUSD;

    uint256 public constant WAD = 1e18;
    uint256 public constant ZQ_PRICE_ZUSD = 1e18;
    uint256 public constant MAX_LTV_BPS = 5000;
    uint256 public constant BPS = 10_000;

    mapping(address => uint256) public collateralZQ;
    mapping(address => uint256) public debtZUSD;
    mapping(address => uint256) public suppliedZUSD;

    uint256 public totalCollateralZQ;
    uint256 public totalDebtZUSD;
    uint256 public totalSuppliedZUSD;

    uint256 private locked = 1;

    event LiquiditySupplied(address indexed account, uint256 amount);
    event LiquidityWithdrawn(address indexed account, uint256 amount);
    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount);
    event Repaid(address indexed account, uint256 amount);

    modifier nonReentrant() {
        require(locked == 1, "reentrant");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address zUSD_) {
        require(zUSD_ != address(0), "zero_token");
        zUSD = IZoryqERC20(zUSD_);
    }

    receive() external payable {
        revert("use_depositCollateral");
    }

    function supplyLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "zero_amount");
        require(zUSD.transferFrom(msg.sender, address(this), amount), "transfer_failed");
        suppliedZUSD[msg.sender] += amount;
        totalSuppliedZUSD += amount;
        emit LiquiditySupplied(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= suppliedZUSD[msg.sender], "invalid_amount");
        require(availableLiquidity() >= amount, "insufficient_liquidity");
        suppliedZUSD[msg.sender] -= amount;
        totalSuppliedZUSD -= amount;
        require(zUSD.transfer(msg.sender, amount), "transfer_failed");
        emit LiquidityWithdrawn(msg.sender, amount);
    }

    function depositCollateral() external payable {
        require(msg.value > 0, "zero_amount");
        collateralZQ[msg.sender] += msg.value;
        totalCollateralZQ += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= collateralZQ[msg.sender], "invalid_amount");
        uint256 remaining = collateralZQ[msg.sender] - amount;
        require(debtZUSD[msg.sender] <= maxBorrowForCollateral(remaining), "ltv_exceeded");
        collateralZQ[msg.sender] = remaining;
        totalCollateralZQ -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer_failed");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        require(amount > 0, "zero_amount");
        uint256 nextDebt = debtZUSD[msg.sender] + amount;
        require(nextDebt <= maxBorrow(msg.sender), "ltv_exceeded");
        require(availableLiquidity() >= amount, "insufficient_liquidity");
        debtZUSD[msg.sender] = nextDebt;
        totalDebtZUSD += amount;
        require(zUSD.transfer(msg.sender, amount), "transfer_failed");
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant {
        uint256 debt = debtZUSD[msg.sender];
        require(amount > 0 && debt > 0, "nothing_to_repay");
        uint256 paid = amount > debt ? debt : amount;
        require(zUSD.transferFrom(msg.sender, address(this), paid), "transfer_failed");
        debtZUSD[msg.sender] = debt - paid;
        totalDebtZUSD -= paid;
        emit Repaid(msg.sender, paid);
    }

    function collateralValueZUSD(address account) public view returns (uint256) {
        return collateralZQ[account] * ZQ_PRICE_ZUSD / WAD;
    }

    function maxBorrow(address account) public view returns (uint256) {
        return maxBorrowForCollateral(collateralZQ[account]);
    }

    function maxBorrowForCollateral(uint256 collateralAmount) public pure returns (uint256) {
        uint256 value = collateralAmount * ZQ_PRICE_ZUSD / WAD;
        return value * MAX_LTV_BPS / BPS;
    }

    function borrowAvailable(address account) external view returns (uint256) {
        uint256 maxAmount = maxBorrow(account);
        uint256 debt = debtZUSD[account];
        return maxAmount > debt ? maxAmount - debt : 0;
    }

    function healthFactor(address account) external view returns (uint256) {
        uint256 debt = debtZUSD[account];
        if (debt == 0) return type(uint256).max;
        return maxBorrow(account) * WAD / debt;
    }

    function availableLiquidity() public view returns (uint256) {
        return zUSD.balanceOf(address(this));
    }

    function position(address account) external view returns (
        uint256 collateral,
        uint256 debt,
        uint256 supplied,
        uint256 maxBorrowAmount,
        uint256 availableBorrowAmount
    ) {
        collateral = collateralZQ[account];
        debt = debtZUSD[account];
        supplied = suppliedZUSD[account];
        maxBorrowAmount = maxBorrow(account);
        availableBorrowAmount = maxBorrowAmount > debt ? maxBorrowAmount - debt : 0;
    }
}
