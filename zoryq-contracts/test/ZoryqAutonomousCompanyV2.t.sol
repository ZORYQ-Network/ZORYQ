// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAutonomousCompanyV2.sol";

interface VmCompanyV2 {
    function prank(address msgSender) external;
}

contract ZoryqAutonomousCompanyV2Test {
    VmCompanyV2 constant vm = VmCompanyV2(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testOneCommandCreatesSevenAgentCompanyAndFirstCycle() public {
        ZoryqAutonomousCompanyV2 c = new ZoryqAutonomousCompanyV2();
        uint256 id = c.launchCompany(
            "ZORYQ Growth Studio",
            "Criar e vender produtos digitais para projetos Web3",
            100 * c.USD(),
            keccak256("Crie uma empresa digital com US$100.")
        );

        require(id == 1, "company id");
        (
            string memory name,
            string memory objective,
            address owner,
            address treasury,
            address token,
            uint256 treasuryBalance,
            uint256 initialBudget,
            uint256 revenue,
            uint256 expenses,
            uint256 profit,
            uint32 cycleCount,
            uint256 teamSize,
            bytes32 constitutionHash,
            bool active,
            bool emergencyStopEnabled,
            uint32 humanInterventions
        ) = c.companySnapshot(id);

        require(keccak256(bytes(name)) == keccak256(bytes("ZORYQ Growth Studio")), "name");
        require(keccak256(bytes(objective)) == keccak256(bytes("Criar e vender produtos digitais para projetos Web3")), "objective");
        require(owner == address(this), "owner");
        require(treasury != address(0) && token != address(0), "infra");
        require(initialBudget == 100 * c.USD(), "budget");
        require(revenue == 40 * c.USD(), "revenue");
        require(expenses == 17 * c.USD(), "expenses");
        require(profit == 23 * c.USD(), "profit");
        require(treasuryBalance == 123 * c.USD(), "treasury");
        require(cycleCount == 1, "cycle");
        require(teamSize == 7, "team");
        require(constitutionHash != bytes32(0), "constitution");
        require(active && emergencyStopEnabled, "safety state");
        require(humanInterventions == 0, "interventions");

        uint256[] memory ids = c.companyAgentIds(id);
        require(ids.length == 7, "seven agents");
        (, , , bytes32 ceoRole, uint32 ceoPermissions, , , uint256 ceoLimit, , bool ceoActive) = c.agents(ids[0]);
        require(ceoRole == bytes32("AI_CEO"), "ceo role");
        require((ceoPermissions & c.PERM_HIRE()) != 0, "ceo hire permission");
        require((ceoPermissions & c.PERM_EMERGENCY()) != 0, "ceo emergency permission");
        require(ceoLimit == 10 * c.USD() && ceoActive, "ceo policy");

        (, , , , , , , , uint256 builderEarned, ) = c.agents(ids[6]);
        require(builderEarned == 4 * c.USD(), "developer paid");

        (, uint256 jobCompany, uint256 lead, uint256 verifier, uint256 marketValue, uint256 cost, , bytes32 resultHash, bool verified, bool settled) = c.jobs(1);
        require(jobCompany == id, "job company");
        require(lead == ids[6], "developer lead");
        require(verifier == ids[3], "research verifier");
        require(marketValue == 40 * c.USD() && cost == 17 * c.USD(), "job economics");
        require(resultHash != bytes32(0) && verified && settled, "job completion");
    }

    function testEmergencyStopBlocksCycleAndResumeRestoresExecution() public {
        ZoryqAutonomousCompanyV2 c = new ZoryqAutonomousCompanyV2();
        uint256 id = c.launchCompany("Safety Studio", "Test emergency stop", 100 * c.USD(), keccak256("safety"));

        c.triggerEmergencyStop(id);
        (bool ok,) = address(c).call(abi.encodeWithSelector(c.runNextCycle.selector, id));
        require(!ok, "stopped company must not run");

        c.resumeCompany(id);
        c.runNextCycle(id);
        (, , , , , uint256 treasuryBalance, , uint256 revenue, uint256 expenses, uint256 profit, uint32 cycleCount, , , bool active, , uint32 humanInterventions) = c.companySnapshot(id);
        require(active, "resumed");
        require(humanInterventions == 2, "interventions tracked");
        require(cycleCount == 2, "second cycle");
        require(revenue == 80 * c.USD(), "revenue 2 cycles");
        require(expenses == 34 * c.USD(), "expenses 2 cycles");
        require(profit == 46 * c.USD(), "profit 2 cycles");
        require(treasuryBalance == 146 * c.USD(), "treasury 2 cycles");
    }
}
