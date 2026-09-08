// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZoryqDexToken {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice ZORYQ DEX v1 testnet AMM for the native ZQ / zUSD pair.
/// @dev Constant-product pool with 30 bps total swap fee: 20 bps retained by LPs and
///      10 bps sent transparently to the protocol treasury. Testnet only; no monetary value.
contract ZoryqDexV1 {
    uint256 public constant BPS = 10_000;
    uint256 public constant TOTAL_FEE_BPS = 30;      // 0.30%
    uint256 public constant LP_FEE_BPS = 20;         // 0.20%
    uint256 public constant PROTOCOL_FEE_BPS = 10;   // 0.10%

    address public owner;
    address public feeRecipient;
    IZoryqDexToken public immutable token;
    bool public active = true;
    uint256 private lockState = 1;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event LiquidityAdded(address indexed provider, uint256 zqAmount, uint256 tokenAmount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 zqAmount, uint256 tokenAmount, uint256 shares);
    event Swap(address indexed account, address indexed assetIn, address indexed assetOut, uint256 amountIn, uint256 amountOut, uint256 lpFee, uint256 protocolFee);
    event ProtocolFeePaid(address indexed recipient, address indexed asset, uint256 amount);
    event FeeRecipientChanged(address indexed previousRecipient, address indexed nextRecipient);
    event StatusChanged(bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "not_owner"); _; }
    modifier live() { require(active, "paused"); _; }
    modifier nonReentrant() { require(lockState == 1, "reentrant"); lockState = 2; _; lockState = 1; }

    constructor(address token_, address feeRecipient_) {
        require(token_ != address(0) && feeRecipient_ != address(0), "zero_address");
        owner = msg.sender;
        token = IZoryqDexToken(token_);
        feeRecipient = feeRecipient_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeRecipientChanged(address(0), feeRecipient_);
    }

    receive() external payable { revert("use_addLiquidity"); }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero_owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setFeeRecipient(address nextRecipient) external onlyOwner {
        require(nextRecipient != address(0), "zero_recipient");
        emit FeeRecipientChanged(feeRecipient, nextRecipient);
        feeRecipient = nextRecipient;
    }

    function setActive(bool enabled) external onlyOwner {
        active = enabled;
        emit StatusChanged(enabled);
    }

    function reserves() public view returns (uint256 zqReserve, uint256 tokenReserve) {
        return (address(this).balance, token.balanceOf(address(this)));
    }

    function addLiquidity(uint256 tokenAmount, uint256 minShares) external payable live nonReentrant returns (uint256 shares) {
        require(msg.value > 0 && tokenAmount > 0, "zero_amount");
        uint256 zqBefore = address(this).balance - msg.value;
        uint256 tokenBefore = token.balanceOf(address(this));

        require(token.transferFrom(msg.sender, address(this), tokenAmount), "token_transfer");

        if (totalSupply == 0) {
            shares = _sqrt(msg.value * tokenAmount);
        } else {
            require(zqBefore > 0 && tokenBefore > 0, "empty_reserve");
            uint256 byZq = msg.value * totalSupply / zqBefore;
            uint256 byToken = tokenAmount * totalSupply / tokenBefore;
            shares = byZq < byToken ? byZq : byToken;
        }

        require(shares > 0 && shares >= minShares, "insufficient_shares");
        totalSupply += shares;
        balanceOf[msg.sender] += shares;
        emit LiquidityAdded(msg.sender, msg.value, tokenAmount, shares);
    }

    function removeLiquidity(uint256 shares, uint256 minZQ, uint256 minToken) external nonReentrant returns (uint256 zqOut, uint256 tokenOut) {
        require(shares > 0 && shares <= balanceOf[msg.sender], "invalid_shares");
        uint256 supply = totalSupply;
        require(supply > 0, "no_liquidity");
        uint256 zqReserve = address(this).balance;
        uint256 tokenReserve = token.balanceOf(address(this));
        zqOut = shares * zqReserve / supply;
        tokenOut = shares * tokenReserve / supply;
        require(zqOut >= minZQ && tokenOut >= minToken && zqOut > 0 && tokenOut > 0, "slippage");

        balanceOf[msg.sender] -= shares;
        totalSupply = supply - shares;
        require(token.transfer(msg.sender, tokenOut), "token_transfer");
        (bool ok,) = payable(msg.sender).call{value: zqOut}("");
        require(ok, "zq_transfer");
        emit LiquidityRemoved(msg.sender, zqOut, tokenOut, shares);
    }

    function quoteZQForToken(uint256 amountIn) public view returns (uint256 amountOut, uint256 lpFee, uint256 protocolFee) {
        (uint256 zqReserve, uint256 tokenReserve) = reserves();
        return _quote(amountIn, zqReserve, tokenReserve);
    }

    function quoteTokenForZQ(uint256 amountIn) public view returns (uint256 amountOut, uint256 lpFee, uint256 protocolFee) {
        (uint256 zqReserve, uint256 tokenReserve) = reserves();
        return _quote(amountIn, tokenReserve, zqReserve);
    }

    function swapZQForToken(uint256 minOut) external payable live nonReentrant returns (uint256 out) {
        require(msg.value > 0, "zero_input");
        uint256 zqReserveBefore = address(this).balance - msg.value;
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 lpFee;
        uint256 protocolFee;
        (out, lpFee, protocolFee) = _quote(msg.value, zqReserveBefore, tokenReserve);
        require(out >= minOut && out > 0, "slippage");

        if (protocolFee > 0) {
            (bool feeOk,) = payable(feeRecipient).call{value: protocolFee}("");
            require(feeOk, "fee_transfer");
            emit ProtocolFeePaid(feeRecipient, address(0), protocolFee);
        }
        require(token.transfer(msg.sender, out), "token_transfer");
        emit Swap(msg.sender, address(0), address(token), msg.value, out, lpFee, protocolFee);
    }

    function swapTokenForZQ(uint256 amountIn, uint256 minOut) external live nonReentrant returns (uint256 out) {
        require(amountIn > 0, "zero_input");
        uint256 zqReserve = address(this).balance;
        uint256 tokenReserveBefore = token.balanceOf(address(this));
        uint256 lpFee;
        uint256 protocolFee;
        (out, lpFee, protocolFee) = _quote(amountIn, tokenReserveBefore, zqReserve);
        require(out >= minOut && out > 0, "slippage");

        require(token.transferFrom(msg.sender, address(this), amountIn), "token_transfer");
        if (protocolFee > 0) {
            require(token.transfer(feeRecipient, protocolFee), "fee_transfer");
            emit ProtocolFeePaid(feeRecipient, address(token), protocolFee);
        }
        (bool ok,) = payable(msg.sender).call{value: out}("");
        require(ok, "zq_transfer");
        emit Swap(msg.sender, address(token), address(0), amountIn, out, lpFee, protocolFee);
    }

    function _quote(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut, uint256 lpFee, uint256 protocolFee) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return (0, 0, 0);
        lpFee = amountIn * LP_FEE_BPS / BPS;
        protocolFee = amountIn * PROTOCOL_FEE_BPS / BPS;
        uint256 effectiveIn = amountIn - lpFee - protocolFee;
        amountOut = reserveOut * effectiveIn / (reserveIn + effectiveIn);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y == 0) return 0;
        z = y;
        uint256 x = y / 2 + 1;
        while (x < z) { z = x; x = (y / x + x) / 2; }
    }
}
