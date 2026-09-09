// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZoryqAgentVault
/// @notice Minimal non-custodial policy vault for scoped agent execution.
/// @dev The owner deposits only the funds they are willing to delegate. Agents never receive the owner's key.
contract ZoryqAgentVault {
    error NotOwner();
    error NotAgent();
    error PermissionDisabled();
    error PermissionExpired();
    error InvalidPermission();
    error PerTxLimit();
    error PeriodLimit();
    error TargetCallFailed(bytes reason);
    error TokenOperationFailed();
    error Reentrancy();

    event PermissionGranted(bytes32 indexed permissionId,address indexed agent,address indexed target,address asset,uint256 maxPerTx,uint256 maxPerPeriod,uint64 periodSeconds,uint64 validUntil);
    event PermissionRevoked(bytes32 indexed permissionId);
    event AgentExecuted(bytes32 indexed permissionId,address indexed agent,address indexed target,address asset,uint256 amount,bytes32 callHash);
    event OwnerWithdrawal(address indexed asset,address indexed to,uint256 amount);

    struct Permission {
        address agent;
        address target;
        address asset; // address(0) = native ZQ
        uint128 maxPerTx;
        uint128 maxPerPeriod;
        uint64 periodSeconds;
        uint64 validUntil;
        uint64 periodStart;
        uint128 spentInPeriod;
        bool enabled;
    }

    address public owner;
    uint256 public permissionNonce;
    mapping(bytes32 => Permission) public permissions;
    bool private locked;

    modifier onlyOwner(){if(msg.sender!=owner)revert NotOwner();_;}
    modifier nonReentrant(){if(locked)revert Reentrancy();locked=true;_;locked=false;}

    constructor(address initialOwner){owner=initialOwner==address(0)?msg.sender:initialOwner;}
    receive() external payable {}

    function transferOwnership(address next) external onlyOwner {
        require(next!=address(0),"zero owner");
        owner=next;
    }

    function grantPermission(
        address agent,
        address target,
        address asset,
        uint128 maxPerTx,
        uint128 maxPerPeriod,
        uint64 periodSeconds,
        uint64 validUntil
    ) external onlyOwner returns(bytes32 id) {
        if(agent==address(0)||target==address(0)||maxPerTx==0||maxPerPeriod<maxPerTx||periodSeconds==0||validUntil<=block.timestamp)revert InvalidPermission();
        id=keccak256(abi.encode(address(this),block.chainid,++permissionNonce,agent,target,asset));
        permissions[id]=Permission({agent:agent,target:target,asset:asset,maxPerTx:maxPerTx,maxPerPeriod:maxPerPeriod,periodSeconds:periodSeconds,validUntil:validUntil,periodStart:uint64(block.timestamp),spentInPeriod:0,enabled:true});
        emit PermissionGranted(id,agent,target,asset,maxPerTx,maxPerPeriod,periodSeconds,validUntil);
    }

    function revokePermission(bytes32 id) external onlyOwner {
        permissions[id].enabled=false;
        emit PermissionRevoked(id);
    }

    function executeNative(bytes32 id,uint256 value,bytes calldata data) external nonReentrant returns(bytes memory result) {
        Permission storage p=_consume(id,value,address(0));
        (bool ok,bytes memory out)=p.target.call{value:value}(data);
        if(!ok)revert TargetCallFailed(out);
        emit AgentExecuted(id,msg.sender,p.target,address(0),value,keccak256(data));
        return out;
    }

    /// @notice Gives the allowlisted target a one-call allowance and then clears it.
    /// @dev Generic execution deliberately does not claim to enforce price/slippage. DEX-specific adapters must do that.
    function executeToken(bytes32 id,uint256 amount,bytes calldata data) external nonReentrant returns(bytes memory result) {
        Permission storage p=_consume(id,amount,pAsset(id));
        uint256 beforeBal=_balanceOf(p.asset,address(this));
        _safeApprove(p.asset,p.target,0);
        _safeApprove(p.asset,p.target,amount);
        (bool ok,bytes memory out)=p.target.call(data);
        _safeApprove(p.asset,p.target,0);
        if(!ok)revert TargetCallFailed(out);
        uint256 afterBal=_balanceOf(p.asset,address(this));
        uint256 actualSpent=beforeBal>afterBal?beforeBal-afterBal:0;
        if(actualSpent>amount)revert PerTxLimit();
        if(actualSpent<amount){
            // _consume reserves `amount`; refund unused budget without external calls.
            p.spentInPeriod-=uint128(amount-actualSpent);
        }
        emit AgentExecuted(id,msg.sender,p.target,p.asset,actualSpent,keccak256(data));
        return out;
    }

    function withdrawNative(address payable to,uint256 amount) external onlyOwner nonReentrant {
        require(to!=address(0),"zero to");
        (bool ok,)=to.call{value:amount}("");require(ok,"native withdraw");
        emit OwnerWithdrawal(address(0),to,amount);
    }

    function withdrawToken(address token,address to,uint256 amount) external onlyOwner nonReentrant {
        require(token!=address(0)&&to!=address(0),"zero");
        _safeTransfer(token,to,amount);
        emit OwnerWithdrawal(token,to,amount);
    }

    function permissionRemaining(bytes32 id) external view returns(uint256 periodRemaining,uint256 perTxMax,bool active) {
        Permission memory p=permissions[id];
        if(!p.enabled||p.validUntil<=block.timestamp)return(0,p.maxPerTx,false);
        uint256 spent=p.spentInPeriod;
        if(block.timestamp>=uint256(p.periodStart)+p.periodSeconds)spent=0;
        periodRemaining=p.maxPerPeriod>spent?p.maxPerPeriod-spent:0;
        return(periodRemaining,p.maxPerTx,true);
    }

    function pAsset(bytes32 id) internal view returns(address){return permissions[id].asset;}

    function _consume(bytes32 id,uint256 amount,address expectedAsset) internal returns(Permission storage p) {
        p=permissions[id];
        if(msg.sender!=p.agent)revert NotAgent();
        if(!p.enabled)revert PermissionDisabled();
        if(p.validUntil<=block.timestamp)revert PermissionExpired();
        if(p.asset!=expectedAsset)revert InvalidPermission();
        if(amount>p.maxPerTx)revert PerTxLimit();
        if(block.timestamp>=uint256(p.periodStart)+p.periodSeconds){p.periodStart=uint64(block.timestamp);p.spentInPeriod=0;}
        if(uint256(p.spentInPeriod)+amount>p.maxPerPeriod)revert PeriodLimit();
        p.spentInPeriod+=uint128(amount);
    }

    function _balanceOf(address token,address account) internal view returns(uint256 value){
        (bool ok,bytes memory data)=token.staticcall(abi.encodeWithSelector(0x70a08231,account));
        if(!ok||data.length<32)revert TokenOperationFailed();
        value=abi.decode(data,(uint256));
    }
    function _safeApprove(address token,address spender,uint256 value) internal {
        (bool ok,bytes memory data)=token.call(abi.encodeWithSelector(0x095ea7b3,spender,value));
        if(!ok||(data.length!=0&&!abi.decode(data,(bool))))revert TokenOperationFailed();
    }
    function _safeTransfer(address token,address to,uint256 value) internal {
        (bool ok,bytes memory data)=token.call(abi.encodeWithSelector(0xa9059cbb,to,value));
        if(!ok||(data.length!=0&&!abi.decode(data,(bool))))revert TokenOperationFailed();
    }
}
