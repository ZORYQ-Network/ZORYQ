// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title ZQ Pre-Mainnet Token
/// @notice Fixed-supply ERC-20 representation intended for use before ZORYQ Mainnet.
/// @dev No owner, no post-deployment minting, no tax, no blacklist.
contract ZQPreMainnet is ERC20, ERC20Permit {
    uint256 public immutable genesisSupply;

    error ZeroTreasury();
    error ZeroSupply();

    constructor(address treasury, uint256 supply)
        ERC20("ZORYQ Pre-Mainnet", "ZQ")
        ERC20Permit("ZORYQ Pre-Mainnet")
    {
        if (treasury == address(0)) revert ZeroTreasury();
        if (supply == 0) revert ZeroSupply();

        genesisSupply = supply;
        _mint(treasury, supply);
    }
}
