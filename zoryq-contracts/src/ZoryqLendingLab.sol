// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZoryqERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
}

/// @notice Testnet-only overcollateralized lending market for native ZQ collateral and zUSD debt.
/// @dev Uses an owner-managed test oracle and conservative limits. Not suitable for real-value assets.
contract ZoryqLendingLab {
    uint256 public constant WAD = 1e18;
    uint256 public constant YEAR = 365 days;
    IZoryqERC20 public immutable debtToken;
    address public owner;
    uint256 public zqPrice = 1e18; // zUSD per 1 ZQ, testnet oracle
    uint256 public maxLtvBps = 5000;
    uint256 public liquidationThresholdBps = 7500;
    uint256 public liquidationBonusBps = 500;
    uint256 public aprBps = 500;
    bool public paused;
    uint256 private lockState = 1;

    struct Position { uint256 collateralZQ; uint256 principal; uint64 lastAccruedAt; }
    mapping(address => Position) public positions;
    mapping(address => uint256) public suppliedZUSD;
    uint256 public totalSuppliedZUSD;

    event Deposit(address indexed user,uint256 amount);
    event Withdraw(address indexed user,uint256 amount);
    event Borrow(address indexed user,uint256 amount);
    event Repay(address indexed user,uint256 amount);
    event LiquiditySupplied(address indexed user,uint256 amount,uint256 userTotal);
    event LiquidityWithdrawn(address indexed user,uint256 amount,uint256 userRemaining);
    event Liquidate(address indexed liquidator,address indexed user,uint256 repaid,uint256 collateralSeized);
    event RiskParameters(uint256 zqPrice,uint256 maxLtvBps,uint256 liquidationThresholdBps,uint256 liquidationBonusBps,uint256 aprBps);
    event Paused(bool value);
    event OwnershipTransferred(address indexed previousOwner,address indexed nextOwner);

    modifier onlyOwner(){ require(msg.sender==owner,"not_owner"); _; }
    modifier nonReentrant(){ require(lockState==1,"reentrant"); lockState=2; _; lockState=1; }
    modifier live(){ require(!paused,"paused"); _; }

    constructor(address zUsd){
        require(zUsd!=address(0),"zero_token");
        debtToken=IZoryqERC20(zUsd);
        owner=msg.sender;
        emit OwnershipTransferred(address(0),msg.sender);
    }

    receive() external payable { deposit(); }

    function accruedDebt(address user) public view returns(uint256){
        Position memory p=positions[user];
        if(p.principal==0) return 0;
        uint256 elapsed=block.timestamp-uint256(p.lastAccruedAt);
        uint256 interest=p.principal*aprBps*elapsed/(10000*YEAR);
        return p.principal+interest;
    }

    function collateralValue(address user) public view returns(uint256){ return positions[user].collateralZQ*zqPrice/WAD; }
    function maxBorrow(address user) public view returns(uint256){ return collateralValue(user)*maxLtvBps/10000; }
    function availableToBorrow(address user) public view returns(uint256){
        uint256 maximum=maxBorrow(user);
        uint256 debt=accruedDebt(user);
        return maximum>debt?maximum-debt:0;
    }
    function healthFactor(address user) public view returns(uint256){ uint256 d=accruedDebt(user); if(d==0)return type(uint256).max; return collateralValue(user)*liquidationThresholdBps*WAD/(10000*d); }
    function liquidatable(address user) public view returns(bool){ return accruedDebt(user)>0 && healthFactor(user)<WAD; }
    function availableLiquidity() public view returns(uint256){ return debtToken.balanceOf(address(this)); }

    function _accrue(address user) internal {
        Position storage p=positions[user];
        if(p.principal>0) p.principal=accruedDebt(user);
        p.lastAccruedAt=uint64(block.timestamp);
    }

    function deposit() public payable live {
        require(msg.value>0,"zero_amount");
        Position storage p=positions[msg.sender];
        _accrue(msg.sender);
        p.collateralZQ+=msg.value;
        emit Deposit(msg.sender,msg.value);
    }

    function supplyLiquidity(uint256 amount) external live nonReentrant {
        require(amount>0,"zero_amount");
        require(debtToken.transferFrom(msg.sender,address(this),amount),"transfer_failed");
        suppliedZUSD[msg.sender]+=amount;
        totalSuppliedZUSD+=amount;
        emit LiquiditySupplied(msg.sender,amount,suppliedZUSD[msg.sender]);
    }

    function withdrawLiquidity(uint256 amount) external live nonReentrant {
        require(amount>0 && amount<=suppliedZUSD[msg.sender],"invalid_amount");
        require(availableLiquidity()>=amount,"insufficient_liquidity");
        suppliedZUSD[msg.sender]-=amount;
        totalSuppliedZUSD-=amount;
        require(debtToken.transfer(msg.sender,amount),"transfer_failed");
        emit LiquidityWithdrawn(msg.sender,amount,suppliedZUSD[msg.sender]);
    }

    function borrow(uint256 amount) external live nonReentrant {
        require(amount>0,"zero_amount");
        _accrue(msg.sender);
        Position storage p=positions[msg.sender];
        require(p.principal+amount<=maxBorrow(msg.sender),"ltv_exceeded");
        require(availableLiquidity()>=amount,"insufficient_liquidity");
        p.principal+=amount;
        require(debtToken.transfer(msg.sender,amount),"transfer_failed");
        emit Borrow(msg.sender,amount);
    }

    function repay(uint256 amount) external nonReentrant {
        require(amount>0,"zero_amount");
        _accrue(msg.sender);
        Position storage p=positions[msg.sender];
        uint256 due=p.principal;
        uint256 pay=amount>due?due:amount;
        require(pay>0,"no_debt");
        require(debtToken.transferFrom(msg.sender,address(this),pay),"transfer_failed");
        p.principal=due-pay;
        emit Repay(msg.sender,pay);
    }

    function withdraw(uint256 amount) external live nonReentrant {
        require(amount>0,"zero_amount");
        _accrue(msg.sender);
        Position storage p=positions[msg.sender];
        require(amount<=p.collateralZQ,"insufficient_collateral");
        p.collateralZQ-=amount;
        require(p.principal==0 || p.principal<=maxBorrow(msg.sender),"ltv_exceeded");
        (bool ok,)=payable(msg.sender).call{value:amount}(""); require(ok,"zq_transfer_failed");
        emit Withdraw(msg.sender,amount);
    }

    function liquidate(address user,uint256 repayAmount) external nonReentrant {
        require(user!=msg.sender,"self_liquidation");
        _accrue(user);
        require(liquidatable(user),"healthy");
        Position storage p=positions[user];
        uint256 pay=repayAmount>p.principal?p.principal:repayAmount;
        require(pay>0,"zero_amount");
        uint256 seizeValue=pay*(10000+liquidationBonusBps)/10000;
        uint256 seizeZQ=seizeValue*WAD/zqPrice;
        if(seizeZQ>p.collateralZQ) seizeZQ=p.collateralZQ;
        require(debtToken.transferFrom(msg.sender,address(this),pay),"transfer_failed");
        p.principal-=pay;
        p.collateralZQ-=seizeZQ;
        (bool ok,)=payable(msg.sender).call{value:seizeZQ}(""); require(ok,"zq_transfer_failed");
        emit Liquidate(msg.sender,user,pay,seizeZQ);
    }

    function setRiskParameters(uint256 price,uint256 ltv,uint256 threshold,uint256 bonus,uint256 apr) external onlyOwner {
        require(price>0,"bad_price"); require(ltv<=7000 && threshold>ltv && threshold<=9000,"bad_ltv"); require(bonus<=1500,"bad_bonus"); require(apr<=3000,"bad_apr");
        zqPrice=price; maxLtvBps=ltv; liquidationThresholdBps=threshold; liquidationBonusBps=bonus; aprBps=apr;
        emit RiskParameters(price,ltv,threshold,bonus,apr);
    }
    function setPaused(bool value) external onlyOwner { paused=value; emit Paused(value); }
    function transferOwnership(address next) external onlyOwner {
        require(next!=address(0),"zero_owner");
        address previous=owner;
        owner=next;
        emit OwnershipTransferred(previous,next);
    }
}
