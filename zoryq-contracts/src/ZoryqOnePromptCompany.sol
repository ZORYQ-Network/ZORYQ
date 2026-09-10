// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only demo dollar. It has no monetary value and is not a real USD stablecoin.
contract ZoryqDemoUSD {
    string public constant name = "ZORYQ Demo USD";
    string public constant symbol = "dUSD";
    uint8 public constant decimals = 6;
    address public immutable minter;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address minter_) { minter = minter_; }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "minter only");
        require(to != address(0), "zero recipient");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero recipient");
        uint256 bal = balanceOf[from];
        require(bal >= amount, "balance");
        unchecked { balanceOf[from] = bal - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// @notice Company-owned vault used as an onchain treasury in the demo.
contract ZoryqCompanyTreasury {
    address public immutable operator;
    address public immutable owner;
    ZoryqDemoUSD public immutable token;

    constructor(address operator_, address owner_, ZoryqDemoUSD token_) {
        operator = operator_;
        owner = owner_;
        token = token_;
    }

    function pay(address to, uint256 amount) external {
        require(msg.sender == operator, "operator only");
        require(token.transfer(to, amount), "payment failed");
    }

    function ownerWithdraw(address to, uint256 amount) external {
        require(msg.sender == owner, "owner only");
        require(token.transfer(to, amount), "withdraw failed");
    }
}

/// @notice Minimal smart vault representing one AI-role economic identity.
contract ZoryqAgentVault {
    address public immutable controller;
    uint256 public immutable companyId;
    bytes32 public immutable role;
    ZoryqDemoUSD public immutable token;

    constructor(address controller_, uint256 companyId_, bytes32 role_, ZoryqDemoUSD token_) {
        controller = controller_;
        companyId = companyId_;
        role = role_;
        token = token_;
    }

    function withdraw(address to, uint256 amount) external {
        require(msg.sender == controller, "controller only");
        require(token.transfer(to, amount), "withdraw failed");
    }
}

/// @title ZORYQ One-Prompt Digital Company Demo
/// @notice Turns a simple budget prompt into a complete onchain company lifecycle.
/// @dev Experimental public-testnet demonstration. dUSD is synthetic demo accounting only.
contract ZoryqOnePromptCompany {
    uint256 public constant USD = 1_000_000;
    uint256 public constant MARKET_REVENUE_PER_CYCLE = 35 * USD;
    uint256 public constant OPERATING_COST_PER_CYCLE = 12 * USD;
    uint256 public constant MAX_CYCLES = 25;

    ZoryqDemoUSD public immutable demoUsd;
    uint256 public companyCount;
    uint256 public agentCount;
    uint256 public jobCount;

    struct Agent {
        uint256 id;
        uint256 companyId;
        address vault;
        bytes32 role;
        uint32 reputationBps;
        uint32 jobsCompleted;
        uint256 earned;
        bool active;
    }

    struct Company {
        uint256 id;
        address owner;
        address treasury;
        bytes32 promptHash;
        bytes32 constitutionHash;
        uint256 initialBudget;
        uint256 revenue;
        uint256 expenses;
        uint32 cycleCount;
        bool active;
    }

    struct Job {
        uint256 id;
        uint256 companyId;
        uint256 leadAgentId;
        uint256 subcontractAgentId;
        uint256 auditorAgentId;
        uint256 marketValue;
        uint256 cost;
        bytes32 specHash;
        bytes32 resultHash;
        bool verified;
        bool settled;
    }

    mapping(uint256 => Company) public companies;
    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256[]) private _companyAgents;

    event CompanyCreated(uint256 indexed companyId, address indexed owner, address treasury, uint256 budget, bytes32 promptHash);
    event TreasuryOpened(uint256 indexed companyId, address treasury, address demoUsd, uint256 startingBalance);
    event ConstitutionInstalled(uint256 indexed companyId, bytes32 constitutionHash, string rules);
    event AgentCreated(uint256 indexed companyId, uint256 indexed agentId, bytes32 indexed role, address vault, uint32 reputationBps);
    event WorkDiscovered(uint256 indexed companyId, uint256 indexed jobId, uint256 marketValue, bytes32 specHash);
    event AgentHired(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 role, uint256 plannedPayment);
    event AgentSubcontracted(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed fromAgentId, uint256 toAgentId, uint256 plannedPayment);
    event WorkExecuted(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash);
    event WorkVerified(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed auditorAgentId, bytes32 resultHash);
    event AgentPaid(uint256 indexed companyId, uint256 indexed jobId, uint256 indexed agentId, address vault, uint256 amount);
    event RevenueGenerated(uint256 indexed companyId, uint256 indexed jobId, uint256 amount, uint256 treasuryBalance);
    event ReputationUpdated(uint256 indexed companyId, uint256 indexed agentId, uint32 reputationBps, uint32 jobsCompleted);
    event CycleCompleted(uint256 indexed companyId, uint256 indexed jobId, uint32 cycleCount, uint256 revenue, uint256 expenses, uint256 treasuryBalance);

    constructor() {
        demoUsd = new ZoryqDemoUSD(address(this));
        // Synthetic market liquidity used only to make the public testnet demo economically observable.
        demoUsd.mint(address(this), 1_000_000 * USD);
    }

    /// @notice One transaction creates the company, AI-role team, treasury, constitution and first revenue cycle.
    function launchCompany(uint256 budgetUsd6, bytes32 promptHash) external returns (uint256 companyId) {
        require(budgetUsd6 >= 25 * USD, "budget too small");
        require(budgetUsd6 <= 10_000 * USD, "demo budget too large");
        require(promptHash != bytes32(0), "prompt required");

        companyId = ++companyCount;
        ZoryqCompanyTreasury treasury = new ZoryqCompanyTreasury(address(this), msg.sender, demoUsd);
        bytes32 constitutionHash = keccak256(abi.encode(
            "ZORYQ_CONSTITUTION_V1",
            msg.sender,
            companyId,
            budgetUsd6,
            promptHash,
            "CEO routes work; Finance settles; Sales finds demand; Builder executes; Auditor verifies; per-cycle spend <= 12 dUSD"
        ));

        companies[companyId] = Company({
            id: companyId,
            owner: msg.sender,
            treasury: address(treasury),
            promptHash: promptHash,
            constitutionHash: constitutionHash,
            initialBudget: budgetUsd6,
            revenue: 0,
            expenses: 0,
            cycleCount: 0,
            active: true
        });

        demoUsd.mint(address(treasury), budgetUsd6);
        emit CompanyCreated(companyId, msg.sender, address(treasury), budgetUsd6, promptHash);
        emit TreasuryOpened(companyId, address(treasury), address(demoUsd), budgetUsd6);
        emit ConstitutionInstalled(companyId, constitutionHash, "CEO routes work; Finance settles; Sales finds demand; Builder executes; Auditor verifies; per-cycle spend <= 12 dUSD");

        _createAgent(companyId, bytes32("AI_CEO"));
        _createAgent(companyId, bytes32("AI_FINANCE"));
        _createAgent(companyId, bytes32("AI_SALES"));
        _createAgent(companyId, bytes32("AI_BUILDER"));
        _createAgent(companyId, bytes32("AI_AUDITOR"));

        _runCycle(companyId);
    }

    /// @notice Runs another fully onchain find->hire->execute->verify->pay->revenue cycle.
    function runNextCycle(uint256 companyId) external returns (uint256 jobId) {
        Company storage c = companies[companyId];
        require(c.active, "company inactive");
        require(c.owner == msg.sender, "owner only");
        jobId = _runCycle(companyId);
    }

    function setCompanyActive(uint256 companyId, bool active) external {
        Company storage c = companies[companyId];
        require(c.owner == msg.sender, "owner only");
        c.active = active;
    }

    function companyAgentIds(uint256 companyId) external view returns (uint256[] memory) {
        return _companyAgents[companyId];
    }

    function companySnapshot(uint256 companyId) external view returns (
        address owner,
        address treasury,
        address token,
        uint256 treasuryBalance,
        uint256 initialBudget,
        uint256 revenue,
        uint256 expenses,
        uint256 profitAfterOperatingCosts,
        uint32 cycleCount,
        uint256 teamSize,
        bytes32 constitutionHash,
        bool active
    ) {
        Company storage c = companies[companyId];
        treasuryBalance = demoUsd.balanceOf(c.treasury);
        profitAfterOperatingCosts = c.revenue >= c.expenses ? c.revenue - c.expenses : 0;
        return (c.owner, c.treasury, address(demoUsd), treasuryBalance, c.initialBudget, c.revenue, c.expenses, profitAfterOperatingCosts, c.cycleCount, _companyAgents[companyId].length, c.constitutionHash, c.active);
    }

    function _createAgent(uint256 companyId, bytes32 role) internal returns (uint256 agentId) {
        Company storage c = companies[companyId];
        agentId = ++agentCount;
        ZoryqAgentVault vault = new ZoryqAgentVault(c.owner, companyId, role, demoUsd);
        agents[agentId] = Agent({
            id: agentId,
            companyId: companyId,
            vault: address(vault),
            role: role,
            reputationBps: 5000,
            jobsCompleted: 0,
            earned: 0,
            active: true
        });
        _companyAgents[companyId].push(agentId);
        emit AgentCreated(companyId, agentId, role, address(vault), 5000);
    }

    function _runCycle(uint256 companyId) internal returns (uint256 jobId) {
        Company storage c = companies[companyId];
        require(c.active, "company inactive");
        require(c.cycleCount < MAX_CYCLES, "cycle cap reached");
        require(demoUsd.balanceOf(c.treasury) >= OPERATING_COST_PER_CYCLE, "treasury below operating cost");

        uint256[] storage team = _companyAgents[companyId];
        require(team.length == 5, "team incomplete");
        uint256 ceoId = team[0];
        uint256 financeId = team[1];
        uint256 salesId = team[2];
        uint256 builderId = team[3];
        uint256 auditorId = team[4];

        jobId = ++jobCount;
        bytes32 specHash = keccak256(abi.encode("DIGITAL_GROWTH_PACKAGE", companyId, c.cycleCount + 1, block.number));
        bytes32 resultHash = keccak256(abi.encode("DELIVERED_AND_VERIFIED", companyId, jobId, builderId, salesId));
        jobs[jobId] = Job({
            id: jobId,
            companyId: companyId,
            leadAgentId: builderId,
            subcontractAgentId: salesId,
            auditorAgentId: auditorId,
            marketValue: MARKET_REVENUE_PER_CYCLE,
            cost: OPERATING_COST_PER_CYCLE,
            specHash: specHash,
            resultHash: bytes32(0),
            verified: false,
            settled: false
        });

        emit WorkDiscovered(companyId, jobId, MARKET_REVENUE_PER_CYCLE, specHash);
        emit AgentHired(companyId, jobId, builderId, agents[builderId].role, 7 * USD);
        emit AgentSubcontracted(companyId, jobId, ceoId, salesId, 3 * USD);
        emit AgentHired(companyId, jobId, financeId, agents[financeId].role, 2 * USD);

        jobs[jobId].resultHash = resultHash;
        emit WorkExecuted(companyId, jobId, builderId, resultHash);
        jobs[jobId].verified = true;
        emit WorkVerified(companyId, jobId, auditorId, resultHash);

        _payAgent(c, jobId, builderId, 7 * USD);
        _payAgent(c, jobId, salesId, 3 * USD);
        _payAgent(c, jobId, financeId, 2 * USD);

        require(demoUsd.transfer(c.treasury, MARKET_REVENUE_PER_CYCLE), "market revenue transfer failed");
        c.expenses += OPERATING_COST_PER_CYCLE;
        c.revenue += MARKET_REVENUE_PER_CYCLE;
        c.cycleCount += 1;
        jobs[jobId].settled = true;

        _rewardReputation(companyId, ceoId, 25, false);
        _rewardReputation(companyId, financeId, 50, true);
        _rewardReputation(companyId, salesId, 75, true);
        _rewardReputation(companyId, builderId, 100, true);
        _rewardReputation(companyId, auditorId, 50, true);

        uint256 treasuryBalance = demoUsd.balanceOf(c.treasury);
        emit RevenueGenerated(companyId, jobId, MARKET_REVENUE_PER_CYCLE, treasuryBalance);
        emit CycleCompleted(companyId, jobId, c.cycleCount, c.revenue, c.expenses, treasuryBalance);
    }

    function _payAgent(Company storage c, uint256 jobId, uint256 agentId, uint256 amount) internal {
        Agent storage a = agents[agentId];
        ZoryqCompanyTreasury(c.treasury).pay(a.vault, amount);
        a.earned += amount;
        emit AgentPaid(c.id, jobId, agentId, a.vault, amount);
    }

    function _rewardReputation(uint256 companyId, uint256 agentId, uint32 delta, bool completedJob) internal {
        Agent storage a = agents[agentId];
        uint256 next = uint256(a.reputationBps) + delta;
        a.reputationBps = uint32(next > 10000 ? 10000 : next);
        if (completedJob) a.jobsCompleted += 1;
        emit ReputationUpdated(companyId, agentId, a.reputationBps, a.jobsCompleted);
    }
}
