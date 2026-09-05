// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqRewardRegistryV2.sol";
import "../src/ZoryqQuestRegistry.sol";
import "../src/ZoryqTestnetStake.sol";

contract ZoryqContractsTest {
    receive() external payable {}

    function testRewardClassAccounting() public {
        ZoryqRewardRegistryV2 r = new ZoryqRewardRegistryV2();
        address user = address(0x1234);
        r.finalizeReward(1, user, ZoryqRewardRegistryV2.RewardClass.Mobile, 100, bytes32(uint256(1)));
        r.finalizeReward(1, user, ZoryqRewardRegistryV2.RewardClass.Validator, 1200, bytes32(uint256(2)));
        (uint256 total,uint256 mobile,uint256 contributor,uint256 validator,uint256 claimed,uint256 claimablePoints)=r.scoreOf(user);
        require(total==1300,"total");
        require(mobile==100,"mobile");
        require(contributor==0,"contributor");
        require(validator==1200,"validator");
        require(claimed==0,"claimed");
        require(claimablePoints==1300,"claimable");
        require(r.epochTotals(1)==1300,"epoch");
        require(r.totalFinalizedPoints()==1300,"global");
    }

    function testRewardBatch() public {
        ZoryqRewardRegistryV2 r = new ZoryqRewardRegistryV2();
        address[] memory accounts = new address[](2);
        accounts[0]=address(0xA1); accounts[1]=address(0xB2);
        ZoryqRewardRegistryV2.RewardClass[] memory classes = new ZoryqRewardRegistryV2.RewardClass[](2);
        classes[0]=ZoryqRewardRegistryV2.RewardClass.Contributor;
        classes[1]=ZoryqRewardRegistryV2.RewardClass.Validator;
        uint256[] memory points = new uint256[](2); points[0]=300; points[1]=3000;
        bytes32[] memory proofs = new bytes32[](2); proofs[0]=bytes32(uint256(3)); proofs[1]=bytes32(uint256(4));
        r.finalizeBatch(2,accounts,classes,points,proofs);
        require(r.finalizedPoints(accounts[0])==300,"a");
        require(r.finalizedPoints(accounts[1])==3000,"b");
        require(r.epochTotals(2)==3300,"batch epoch");
    }

    function testQuestLifecycle() public {
        ZoryqQuestRegistry q = new ZoryqQuestRegistry(address(this));
        uint256 id=q.createQuest("First TX","ipfs://quest",100,0,0);
        require(id==1,"id");
        require(q.isQuestLive(id),"live");
        q.updateQuest(id,"First TX v2","ipfs://quest2",150,0,0);
        (uint256 qid,,,,,,bool active)=q.quests(id);
        require(qid==1 && active,"updated");
        q.setQuestActive(id,false);
        require(!q.isQuestLive(id),"paused");
    }

    function testNativeStakeRoundTrip() public {
        ZoryqTestnetStake s = new ZoryqTestnetStake();
        uint256 beforeBalance = address(this).balance;
        s.stake{value: 1 ether}();
        require(s.staked(address(this))==1 ether,"stake balance");
        require(s.totalStaked()==1 ether,"total stake");
        s.unstake(1 ether);
        require(s.staked(address(this))==0,"unstake balance");
        require(s.totalStaked()==0,"total unstake");
        require(address(this).balance==beforeBalance,"round trip");
    }
}
