// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ZoryqDexV1.sol";
import "../src/ZoryqTestToken.sol";

contract ZoryqDexV1Test is Test {
    ZoryqTestToken token;
    ZoryqDexV1 dex;
    address treasury = address(0xBEEF);
    address lp = address(0x1111);
    address trader = address(0x2222);

    function setUp() public {
        token = new ZoryqTestToken("ZORYQ USD", "zUSD", address(this));
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
        assertGt(dex.balanceOf(lp), 0);
        (uint256 zqReserve, uint256 tokenReserve) = dex.reserves();
        assertEq(zqReserve, 1_000 ether);
        assertEq(tokenReserve, 1_000 ether);
    }

    function testZQSwapPaysTreasuryAndRetainsLpFee() public {
        uint256 treasuryBefore = treasury.balance;
        vm.prank(trader);
        uint256 out = dex.swapZQForToken{value: 100 ether}(0);
        assertGt(out, 0);
        assertEq(treasury.balance - treasuryBefore, 0.1 ether);

        (uint256 zqReserve,) = dex.reserves();
        assertEq(zqReserve, 1_099.9 ether);
    }

    function testTokenSwapPaysTreasuryInToken() public {
        vm.startPrank(trader);
        token.approve(address(dex), type(uint256).max);
        uint256 beforeFee = token.balanceOf(treasury);
        uint256 out = dex.swapTokenForZQ(100 ether, 0);
        vm.stopPrank();
        assertGt(out, 0);
        assertEq(token.balanceOf(treasury) - beforeFee, 0.1 ether);
    }

    function testFeeRecipientCanChangeOnlyByOwner() public {
        address next = address(0xCAFE);
        vm.prank(trader);
        vm.expectRevert("not_owner");
        dex.setFeeRecipient(next);

        dex.setFeeRecipient(next);
        assertEq(dex.feeRecipient(), next);
    }

    function testRemoveLiquidityReturnsAssets() public {
        uint256 shares = dex.balanceOf(lp) / 2;
        uint256 zqBefore = lp.balance;
        uint256 tokenBefore = token.balanceOf(lp);
        vm.prank(lp);
        dex.removeLiquidity(shares, 0, 0);
        assertGt(lp.balance, zqBefore);
        assertGt(token.balanceOf(lp), tokenBefore);
    }
}
