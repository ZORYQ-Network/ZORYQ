// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Testnet ERC-20 used by ZORYQ Swap Lab examples.
/// This contract is not intended as the future ZORYQ production token.
contract ZoryqTestToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(string memory name_, string memory symbol_, uint256 initialSupply, address recipient, address initialOwner) {
        require(recipient != address(0), "zero_recipient");
        require(initialOwner != address(0), "zero_owner");
        name = name_;
        symbol = symbol_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        _mint(recipient, initialSupply);
    }

    function transferOwnership(address nextOwner) external {
        require(msg.sender == owner, "not_owner");
        require(nextOwner != address(0), "zero_owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external {
        require(msg.sender == owner, "not_owner");
        _mint(to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "zero_to");
        require(balanceOf[from] >= value, "balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
