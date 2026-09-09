// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqAgentVault.sol";

interface VmAgent {
    function deal(address who,uint256 newBalance) external;
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 selector) external;
}

contract MockAgentToken {
    string public constant name="Mock";
    string public constant symbol="MOCK";
    uint8 public constant decimals=18;
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transfer(address to,uint256 amount) external returns(bool){require(balanceOf[msg.sender]>=amount,"bal");balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){uint256 a=allowance[from][msg.sender];require(a>=amount,"allow");require(balanceOf[from]>=amount,"bal");allowance[from][msg.sender]=a-amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
}

contract MockAllowedTarget {
    receive() external payable {}
    function spendToken(address token,address from,address recipient,uint256 amount) external {
        MockAgentToken(token).transferFrom(from,recipient,amount);
    }
}

contract ZoryqAgentVaultTest {
    VmAgent constant vm=VmAgent(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant AGENT=address(0xA11CE);
    address constant RECIPIENT=address(0xBEEF);

    function testNativeBudgetAndRevocation() public {
        ZoryqAgentVault vault=new ZoryqAgentVault(address(this));
        MockAllowedTarget target=new MockAllowedTarget();
        vm.deal(address(vault),10 ether);
        bytes32 id=vault.grantPermission(AGENT,address(target),address(0),1 ether,2 ether,1 days,uint64(block.timestamp+7 days));
        vm.prank(AGENT);vault.executeNative(id,1 ether,"");
        require(address(target).balance==1 ether,"native execution");
        vm.prank(AGENT);vault.executeNative(id,1 ether,"");
        require(address(target).balance==2 ether,"period budget");
        vm.expectRevert(ZoryqAgentVault.PeriodLimit.selector);vm.prank(AGENT);vault.executeNative(id,1 wei,"");
        vault.revokePermission(id);
        vm.expectRevert(ZoryqAgentVault.PermissionDisabled.selector);vm.prank(AGENT);vault.executeNative(id,1 wei,"");
    }

    function testTokenAllowanceIsOneCallAndUnusedBudgetRefunded() public {
        ZoryqAgentVault vault=new ZoryqAgentVault(address(this));
        MockAgentToken token=new MockAgentToken();
        MockAllowedTarget target=new MockAllowedTarget();
        token.mint(address(vault),1000 ether);
        bytes32 id=vault.grantPermission(AGENT,address(target),address(token),100 ether,200 ether,1 days,uint64(block.timestamp+7 days));
        bytes memory callData=abi.encodeCall(MockAllowedTarget.spendToken,(address(token),address(vault),RECIPIENT,60 ether));
        vm.prank(AGENT);vault.executeToken(id,100 ether,callData);
        require(token.balanceOf(RECIPIENT)==60 ether,"recipient");
        require(token.allowance(address(vault),address(target))==0,"allowance cleared");
        (uint256 remaining,,)=vault.permissionRemaining(id);
        require(remaining==140 ether,"unused reserved budget refunded");
    }

    function testWrongAgentAndPerTxLimitRevert() public {
        ZoryqAgentVault vault=new ZoryqAgentVault(address(this));
        MockAllowedTarget target=new MockAllowedTarget();
        vm.deal(address(vault),10 ether);
        bytes32 id=vault.grantPermission(AGENT,address(target),address(0),1 ether,5 ether,1 days,uint64(block.timestamp+1 days));
        vm.expectRevert(ZoryqAgentVault.NotAgent.selector);vault.executeNative(id,1 wei,"");
        vm.expectRevert(ZoryqAgentVault.PerTxLimit.selector);vm.prank(AGENT);vault.executeNative(id,2 ether,"");
    }

    function testPeriodResets() public {
        ZoryqAgentVault vault=new ZoryqAgentVault(address(this));
        MockAllowedTarget target=new MockAllowedTarget();
        vm.deal(address(vault),10 ether);
        bytes32 id=vault.grantPermission(AGENT,address(target),address(0),1 ether,1 ether,1 hours,uint64(block.timestamp+1 days));
        vm.prank(AGENT);vault.executeNative(id,1 ether,"");
        vm.warp(block.timestamp+1 hours+1);
        vm.prank(AGENT);vault.executeNative(id,1 ether,"");
        require(address(target).balance==2 ether,"period reset");
    }
}
