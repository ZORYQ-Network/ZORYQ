// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ZoryqRewardRegistryV2.sol";
import "./ZoryqQuestRegistry.sol";
import "./ZoryqQuestCompletionRegistry.sol";
import "./ZoryqTestnetStake.sol";
import "./ZoryqTestToken.sol";
import "./ZoryqSwapLab.sol";

/// @notice One-shot Testnet bootstrap that deploys the current ZORYQ contract suite atomically.
/// The bootstrap retains no privileged ownership after construction.
contract ZoryqBootstrap {
    address public immutable admin;
    ZoryqRewardRegistryV2 public immutable rewardRegistry;
    ZoryqQuestRegistry public immutable questRegistry;
    ZoryqQuestCompletionRegistry public immutable questCompletionRegistry;
    ZoryqTestnetStake public immutable stakeContract;
    ZoryqTestToken public immutable testToken;
    ZoryqSwapLab public immutable swapContract;

    constructor(address admin_) payable {
        require(admin_ != address(0), "zero_admin");
        require(msg.value == 10 ether, "need_10_zq");
        admin = admin_;

        ZoryqRewardRegistryV2 reward = new ZoryqRewardRegistryV2();
        ZoryqQuestRegistry quests = new ZoryqQuestRegistry(admin_);
        ZoryqQuestCompletionRegistry completions = new ZoryqQuestCompletionRegistry(admin_);
        ZoryqTestnetStake stake = new ZoryqTestnetStake();
        ZoryqTestToken token = new ZoryqTestToken(
            "ZORYQ Test USD",
            "zUSD",
            1_000_000 ether,
            address(this),
            admin_
        );
        ZoryqSwapLab swap = new ZoryqSwapLab(address(token), 100 ether);

        require(token.transfer(address(swap), 100_000 ether), "seed_token_failed");
        (bool zqOk,) = payable(address(swap)).call{value: 10 ether}("");
        require(zqOk, "seed_zq_failed");
        require(token.transfer(admin_, 900_000 ether), "admin_token_failed");

        reward.transferOwnership(admin_);
        swap.transferOwnership(admin_);

        rewardRegistry = reward;
        questRegistry = quests;
        questCompletionRegistry = completions;
        stakeContract = stake;
        testToken = token;
        swapContract = swap;
    }
}
