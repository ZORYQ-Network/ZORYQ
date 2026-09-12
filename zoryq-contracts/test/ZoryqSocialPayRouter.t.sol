// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqSocialPayRouter.sol";
import "../src/ZoryqTestToken.sol";

interface VmSocialPay {
    function deal(address who, uint256 newBalance) external;
}

contract ZoryqSocialPayRouterTest {
    VmSocialPay constant vm = VmSocialPay(address(uint160(uint256(keccak256("hevm cheat code")))));
    receive() external payable {}

    function testNativePaymentSplitsHalfPercent() public {
        vm.deal(address(this), 10 ether);
        address payable treasury = payable(address(0xBEEF));
        address payable recipient = payable(address(0xCAFE));
        ZoryqSocialPayRouter router = new ZoryqSocialPayRouter(address(this), treasury, 50);

        uint256 treasuryBefore = treasury.balance;
        uint256 recipientBefore = recipient.balance;
        router.payNative{value: 1 ether}(recipient, keccak256("profile-payment"));

        require(treasury.balance - treasuryBefore == 0.005 ether, "treasury fee");
        require(recipient.balance - recipientBefore == 0.995 ether, "recipient amount");
        require(address(router).balance == 0, "router must not custody funds");
    }

    function testTokenPaymentSplitsHalfPercent() public {
        address treasury = address(0xBEEF);
        address recipient = address(0xCAFE);
        ZoryqSocialPayRouter router = new ZoryqSocialPayRouter(address(this), payable(treasury), 50);
        ZoryqTestToken token = new ZoryqTestToken("ZORYQ Test USD", "zUSD", 1_000_000 ether, address(this), address(this));
        require(token.approve(address(router), 1000 ether), "approve");

        router.payToken(address(token), recipient, 1000 ether, keccak256("token-profile-payment"));

        require(token.balanceOf(treasury) == 5 ether, "treasury token fee");
        require(token.balanceOf(recipient) == 995 ether, "recipient token amount");
        require(token.balanceOf(address(router)) == 0, "router token custody");
    }

    function testFeeHasHardCap() public {
        ZoryqSocialPayRouter router = new ZoryqSocialPayRouter(address(this), payable(address(0xBEEF)), 50);
        bool reverted;
        try router.setFeeBps(251) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "fee cap");
        router.setFeeBps(100);
        require(router.feeBps() == 100, "fee update");
    }

    function testOnlyOwnerCanChangeTreasuryThroughExternalCaller() public {
        ZoryqSocialPayRouter router = new ZoryqSocialPayRouter(address(this), payable(address(0xBEEF)), 50);
        RouterCaller caller = new RouterCaller();
        require(!caller.trySetTreasury(router, payable(address(0x1234))), "non owner changed treasury");
        require(router.treasury() == address(0xBEEF), "treasury changed");
    }
}

contract RouterCaller {
    function trySetTreasury(ZoryqSocialPayRouter router, address payable treasury) external returns (bool ok) {
        try router.setTreasury(treasury) { return true; } catch { return false; }
    }
}
