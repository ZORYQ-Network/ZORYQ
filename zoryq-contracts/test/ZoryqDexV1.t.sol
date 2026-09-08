// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqDexV1.sol";
import "../src/ZoryqTestToken.sol";

interface VmDex {
    function deal(address who, uint256 newBalance) external;
    function prank(address who) external;
    function startPrank(address who) external;
    function stopPrank() external;
    function expectRevert(bytes calldata) external;
}

contract ZoryqDexV1Test {
    VmDex constant vm = VmDex(address(uint160(uint256(keccak256("hevm cheat code")))));
    ZoryqTestToken token;
    ZoryqDexV1 dex;
    address treasury = address(0xBEEF);
    address lp = address(0x1111);
    address trader = address(0x2222);

    function setUp() public {
        token = new ZoryqTestToken("ZORYQ USD", "zUSD", 0, address(this), address(this));
        dex = new ZoryqDexV1(address(token), treasury);

        token.mint(lp, 100_000 ether);
        token.mint(trader, 10_000 ether);
        vm.deal(lp, 10_000 ether);
        vm.deal(trader, 1_000 ether);

        vm.startPrank(lp);
        token.approve(address(dex), type(uint256).max);
        dex.addLiquidity{value: 1_000 ether}(1_000 ether, 0);
        vm.stopPrank();
    }

    function testInitialLiquidityMintsShares() public view {
        require(dex.balanceOf(lp) > 0, "shares");
        (uint256 zqReserve, uint256 tokenReserve) = dex.reserves();
        require(zqReserve == 1_000 ether, "zq_reserve");
        require(tokenReserve == 1_000 ether, "token_reserve");
    }

    function testZQSwapPaysTreasuryAndRetainsLpFee() public {
        uint256 treasuryBefore = treasury.balance;
        vm.prank(trader);
        uint256 out = dex.swapZQForToken{value: 100 ether}(0);
        require(out > 0, "out");
        require(treasury.balance - treasuryBefore == 0.1 ether, "treasury_fee");
        (uint256 zqReserve,) = dex.reserves();
        require(zqReserve == 1_099.9 ether, "reserve_after_fee");
    }

    function testTokenSwapPaysTreasuryInToken() public {
        vm.startPrank(trader);
        token.approve(address(dex), type(uint256).max);
        uint256 beforeFee = token.balanceOf(treasury);
        uint256 out = dex.swapTokenForZQ(100 ether, 0);
        vm.stopPrank();
        require(out > 0, "out");
        require(token.balanceOf(treasury) - beforeFee == 0.1 ether, "treasury_token_fee");
    }

    function testFeeRecipientCanChangeOnlyByOwner() public {
        address next = address(0xCAFE);
        vm.startPrank(trader);
        vm.expectRevert(bytes("not_owner"));
        dex.setFeeRecipient(next);
        vm.stopPrank();
        dex.setFeeRecipient(next);
        require(dex.feeRecipient() == next, "recipient");
    }

    function testRemoveLiquidityReturnsAssets() public {
        uint256 shares = dex.balanceOf(lp) / 2;
        uint256 zqBefore = lp.balance;
        uint256 tokenBefore = token.balanceOf(lp);
        vm.prank(lp);
        dex.removeLiquidity(shares, 0, 0);
        require(lp.balance > zqBefore, "zq_return");
        require(token.balanceOf(lp) > tokenBefore, "token_return");
    }
}
