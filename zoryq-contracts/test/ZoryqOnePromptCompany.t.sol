// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqOnePromptCompany.sol";

interface VmOnePrompt {
    function prank(address msgSender) external;
}

contract ZoryqOnePromptCompanyTest {
    VmOnePrompt constant vm = VmOnePrompt(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testLaunchCompanyWith100UsdRunsCompleteCycle() public {
        ZoryqOnePromptCompany d = new ZoryqOnePromptCompany();
        uint256 companyId = d.launchCompany(100 * d.USD(), keccak256("Crie uma empresa digital com US$100."));

        (
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
            bool active
        ) = d.companySnapshot(companyId);

        require(owner == address(this), "wrong owner");
        require(treasury != address(0), "treasury missing");
        require(token == address(d.demoUsd()), "token missing");
        require(initialBudget == 100 * d.USD(), "initial budget");
        require(treasuryBalance == 123 * d.USD(), "treasury should be 100 - 12 + 35");
        require(revenue == 35 * d.USD(), "revenue");
        require(expenses == 12 * d.USD(), "expenses");
        require(profit == 23 * d.USD(), "operating profit");
        require(cycleCount == 1, "cycle count");
        require(teamSize == 5, "team size");
        require(constitutionHash != bytes32(0), "constitution");
        require(active, "company active");

        uint256[] memory ids = d.companyAgentIds(companyId);
        require(ids.length == 5, "agent ids");

        (, , address financeVault, bytes32 financeRole, uint32 financeRep, uint32 financeJobs, uint256 financeEarned, bool financeActive) = d.agents(ids[1]);
        require(financeRole == bytes32("AI_FINANCE"), "finance role");
        require(financeRep == 5050, "finance reputation");
        require(financeJobs == 1, "finance jobs");
        require(financeEarned == 2 * d.USD(), "finance earnings");
        require(financeActive, "finance active");
        require(d.demoUsd().balanceOf(financeVault) == 2 * d.USD(), "finance vault paid");

        (, , address salesVault, , uint32 salesRep, uint32 salesJobs, uint256 salesEarned, ) = d.agents(ids[2]);
        require(salesRep == 5075, "sales reputation");
        require(salesJobs == 1, "sales jobs");
        require(salesEarned == 3 * d.USD(), "sales earnings");
        require(d.demoUsd().balanceOf(salesVault) == 3 * d.USD(), "sales vault paid");

        (, , address builderVault, , uint32 builderRep, uint32 builderJobs, uint256 builderEarned, ) = d.agents(ids[3]);
        require(builderRep == 5100, "builder reputation");
        require(builderJobs == 1, "builder jobs");
        require(builderEarned == 7 * d.USD(), "builder earnings");
        require(d.demoUsd().balanceOf(builderVault) == 7 * d.USD(), "builder vault paid");

        (, uint256 jobCompany, uint256 leadId, uint256 subcontractId, uint256 auditorId, uint256 marketValue, uint256 cost, bytes32 specHash, bytes32 resultHash, bool verified, bool settled) = d.jobs(1);
        require(jobCompany == companyId, "job company");
        require(leadId == ids[3], "builder should lead");
        require(subcontractId == ids[2], "sales subcontract");
        require(auditorId == ids[4], "auditor");
        require(marketValue == 35 * d.USD(), "market value");
        require(cost == 12 * d.USD(), "job cost");
        require(specHash != bytes32(0) && resultHash != bytes32(0), "proof hashes");
        require(verified && settled, "job lifecycle incomplete");
    }

    function testOwnerCanRunAnotherRevenueCycle() public {
        ZoryqOnePromptCompany d = new ZoryqOnePromptCompany();
        uint256 companyId = d.launchCompany(100 * d.USD(), keccak256("Crie uma empresa digital com US$100."));
        d.runNextCycle(companyId);

        (, , , uint256 treasuryBalance, , uint256 revenue, uint256 expenses, uint256 profit, uint32 cycleCount, , , ) = d.companySnapshot(companyId);
        require(treasuryBalance == 146 * d.USD(), "second cycle treasury");
        require(revenue == 70 * d.USD(), "second cycle revenue");
        require(expenses == 24 * d.USD(), "second cycle expenses");
        require(profit == 46 * d.USD(), "second cycle profit");
        require(cycleCount == 2, "second cycle count");
    }

    function testOnlyOwnerCanRunNextCycle() public {
        ZoryqOnePromptCompany d = new ZoryqOnePromptCompany();
        uint256 companyId = d.launchCompany(100 * d.USD(), keccak256("Crie uma empresa digital com US$100."));
        vm.prank(address(0xBEEF));
        (bool ok,) = address(d).call(abi.encodeWithSelector(d.runNextCycle.selector, companyId));
        require(!ok, "non-owner must not run company cycle");
    }
}
