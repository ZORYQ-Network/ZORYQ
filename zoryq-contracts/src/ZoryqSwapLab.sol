// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZoryqTestToken {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Testnet swap lab for producing real, verifiable swap events.
/// Uses an owner-configured fixed quote for controlled Testnet experiments.
/// Not intended as a production AMM or investment venue.
contract ZoryqSwapLab {
    address public owner;
    IZoryqTestToken public immutable token;
    uint256 public tokensPerZQ;
    bool public active = true;

    event Swap(address indexed account, address indexed assetIn, address indexed assetOut, uint256 amountIn, uint256 amountOut);
    event QuoteUpdated(uint256 tokensPerZQ);
    event StatusChanged(bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not_owner");
        _;
    }

    constructor(address token_, uint256 tokensPerZQ_) {
        require(token_ != address(0), "zero_token");
        require(tokensPerZQ_ > 0, "zero_quote");
        owner = msg.sender;
        token = IZoryqTestToken(token_);
        tokensPerZQ = tokensPerZQ_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    receive() external payable {}

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero_owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setQuote(uint256 nextTokensPerZQ) external onlyOwner {
        require(nextTokensPerZQ > 0, "zero_quote");
        tokensPerZQ = nextTokensPerZQ;
        emit QuoteUpdated(nextTokensPerZQ);
    }

    function setActive(bool enabled) external onlyOwner {
        active = enabled;
        emit StatusChanged(enabled);
    }

    function swapZQForToken(uint256 minOut) external payable returns (uint256 out) {
        require(active, "paused");
        require(msg.value > 0, "zero_input");
        out = msg.value * tokensPerZQ / 1 ether;
        require(out >= minOut && out > 0, "slippage");
        require(token.balanceOf(address(this)) >= out, "token_liquidity");
        require(token.transfer(msg.sender, out), "token_transfer");
        emit Swap(msg.sender, address(0), address(token), msg.value, out);
    }

    function swapTokenForZQ(uint256 amountIn, uint256 minOut) external returns (uint256 out) {
        require(active, "paused");
        require(amountIn > 0, "zero_input");
        out = amountIn * 1 ether / tokensPerZQ;
        require(out >= minOut && out > 0, "slippage");
        require(address(this).balance >= out, "zq_liquidity");
        require(token.transferFrom(msg.sender, address(this), amountIn), "token_transfer");
        (bool ok,) = payable(msg.sender).call{value: out}("");
        require(ok, "zq_transfer");
        emit Swap(msg.sender, address(token), address(0), amountIn, out);
    }

    function reserves() external view returns (uint256 zqReserve, uint256 tokenReserve) {
        return (address(this).balance, token.balanceOf(address(this)));
    }
}
