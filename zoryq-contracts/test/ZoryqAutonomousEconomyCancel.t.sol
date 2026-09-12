// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAutonomousEconomy.sol";

interface VmAutonomousCancel {
    function deal(address who, uint256 newBalance) external;
    function prank(address msgSender) external;
}

contract ZoryqAutonomousEconomyCancelTest {
    VmAutonomousCancel constant vm = VmAutonomousCancel(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function testAssignedCancellationRestoresEscrowAndCountsWorkerFailure() public {
        ZoryqAutonomousEconomy economy = new ZoryqAutonomousEconomy();
        address worker = address(0xA11CE);
        vm.deal(address(this), 10 ether);

        vm.prank(worker);
        economy.registerAgent(bytes32("AI Worker"), keccak256("worker-meta"), keccak256("research-build"));

        uint256 orgId = economy.createOrganization(bytes32("Autonomous Co"), keccak256("goal-policy-v1"), 5 ether);
        economy.fundOrganization{value: 4 ether}(orgId);
        uint256 taskId = economy.createTask(orgId, keccak256("bounded task"), 1 ether, uint64(block.timestamp + 1 days));

        vm.prank(worker);
        economy.bidForTask(taskId, 8 ether / 10, keccak256("worker-proposal"));
        economy.assignTask(taskId, worker);

        require(_orgBalance(economy, orgId) == 3 ether, "escrow must leave org balance");
        require(_failedTasks(economy, worker) == 0, "unexpected initial failure count");

        economy.cancelTask(taskId);

        require(_orgBalance(economy, orgId) == 4 ether, "full escrow must return");
        require(_failedTasks(economy, worker) == 1, "assigned cancellation must count failure");
        require(_taskEscrow(economy, taskId) == 0, "escrow must clear");
        require(_taskStatus(economy, taskId) == ZoryqAutonomousEconomy.TaskStatus.Cancelled, "task must cancel");
    }

    function _orgBalance(ZoryqAutonomousEconomy economy, uint256 orgId) private view returns (uint256 balance) {
        (, , balance, , , , , ) = economy.organizationSummary(orgId);
    }

    function _failedTasks(ZoryqAutonomousEconomy economy, address worker) private view returns (uint256 failed) {
        (, , , , failed, , , ) = economy.agentSummary(worker);
    }

    function _taskEscrow(ZoryqAutonomousEconomy economy, uint256 taskId) private view returns (uint256 escrowed) {
        (, , , , , , , escrowed, , ) = economy.taskSummary(taskId);
    }

    function _taskStatus(ZoryqAutonomousEconomy economy, uint256 taskId) private view returns (ZoryqAutonomousEconomy.TaskStatus status) {
        (, , , , , , , , , status) = economy.taskSummary(taskId);
    }
}
