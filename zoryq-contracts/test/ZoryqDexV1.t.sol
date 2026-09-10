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
    address nextOwner = address(0xCAFE);

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
        require(dex.balanceOf(lp) == 1_000 ether, "initial_shares");
        require(dex.totalSupply() == 1_000 ether, "initial_supply");
        (uint256 zqReserve, uint256 tokenReserve) = dex.reserves();
        require(zqReserve == 1_000 ether, "zq_reserve");
        require(tokenReserve == 1_000 ether, "token_reserve");
    }

    function testQuoteFeeSplitIsExactlyThirtyBps() public view {
        (,uint256 lpFee,uint256 protocolFee)=dex.quoteZQForToken(100 ether);
        require(lpFee == 0.2 ether, "lp_fee_20bps");
        require(protocolFee == 0.1 ether, "protocol_fee_10bps");
        require(lpFee + protocolFee == 0.3 ether, "total_fee_30bps");
    }

    function testZQSwapPaysTreasuryAndRetainsLpFee() public {
        (uint256 expectedOut,uint256 expectedLpFee,uint256 expectedProtocolFee)=dex.quoteZQForToken(100 ether);
        uint256 treasuryBefore = treasury.balance;
        uint256 traderTokenBefore = token.balanceOf(trader);
        vm.prank(trader);
        uint256 out = dex.swapZQForToken{value: 100 ether}(expectedOut);
        require(out == expectedOut, "quote_execution_mismatch");
        require(token.balanceOf(trader) - traderTokenBefore == expectedOut, "output_transfer");
        require(treasury.balance - treasuryBefore == expectedProtocolFee, "treasury_fee");
        require(expectedLpFee == 0.2 ether, "lp_fee");
        (uint256 zqReserve,) = dex.reserves();
        require(zqReserve == 1_099.9 ether, "reserve_after_fee");
    }

    function testTokenSwapPaysTreasuryInToken() public {
        (uint256 expectedOut,,uint256 expectedProtocolFee)=dex.quoteTokenForZQ(100 ether);
        vm.startPrank(trader);
        token.approve(address(dex), type(uint256).max);
        uint256 beforeFee = token.balanceOf(treasury);
        uint256 zqBefore = trader.balance;
        uint256 out = dex.swapTokenForZQ(100 ether, expectedOut);
        vm.stopPrank();
        require(out == expectedOut, "quote_execution_mismatch");
        require(token.balanceOf(treasury) - beforeFee == expectedProtocolFee, "treasury_token_fee");
        require(trader.balance == zqBefore + expectedOut, "zq_output");
    }

    function testSwapSlippageProtectionReverts() public {
        (uint256 expectedOut,,)=dex.quoteZQForToken(10 ether);
        vm.prank(trader);
        vm.expectRevert(bytes("slippage"));
        dex.swapZQForToken{value: 10 ether}(expectedOut + 1);

        vm.startPrank(trader);
        token.approve(address(dex), type(uint256).max);
        (uint256 tokenExpectedOut,,)=dex.quoteTokenForZQ(10 ether);
        vm.expectRevert(bytes("slippage"));
        dex.swapTokenForZQ(10 ether, tokenExpectedOut + 1);
        vm.stopPrank();
    }

    function testPauseBlocksNewLiquidityAndSwapsButAllowsExit() public {
        dex.setActive(false);
        vm.prank(trader);
        vm.expectRevert(bytes("paused"));
        dex.swapZQForToken{value: 1 ether}(0);

        vm.startPrank(lp);
        vm.expectRevert(bytes("paused"));
        dex.addLiquidity{value: 1 ether}(1 ether,0);
        uint256 shares=dex.balanceOf(lp)/10;
        uint256 before=lp.balance;
        dex.removeLiquidity(shares,0,0);
        vm.stopPrank();
        require(lp.balance>before,"paused_exit_must_work");
    }

    function testMinSharesProtectsLiquidityProvider() public {
        vm.prank(lp);
        vm.expectRevert(bytes("insufficient_shares"));
        dex.addLiquidity{value: 10 ether}(10 ether, 11 ether);
    }

    function testRemoveLiquiditySlippageProtection() public {
        uint256 shares=dex.balanceOf(lp)/10;
        (uint256 zqReserve,uint256 tokenReserve)=dex.reserves();
        uint256 zqExpected=shares*zqReserve/dex.totalSupply();
        uint256 tokenExpected=shares*tokenReserve/dex.totalSupply();
        vm.prank(lp);
        vm.expectRevert(bytes("slippage"));
        dex.removeLiquidity(shares,zqExpected+1,tokenExpected);
    }

    function testFeeRecipientCanChangeOnlyByOwner() public {
        vm.startPrank(trader);
        vm.expectRevert(bytes("not_owner"));
        dex.setFeeRecipient(nextOwner);
        vm.stopPrank();
        dex.setFeeRecipient(nextOwner);
        require(dex.feeRecipient() == nextOwner, "recipient");
    }

    function testOwnershipTransferMovesAdminAuthority() public {
        dex.transferOwnership(nextOwner);
        vm.expectRevert(bytes("not_owner"));
        dex.setActive(false);
        vm.prank(nextOwner);
        dex.setActive(false);
        require(!dex.active(),"new_owner_admin");
    }

    function testRemoveLiquidityReturnsAssetsAndBurnsShares() public {
        uint256 shares = dex.balanceOf(lp) / 2;
        uint256 supplyBefore=dex.totalSupply();
        uint256 zqBefore = lp.balance;
        uint256 tokenBefore = token.balanceOf(lp);
        vm.prank(lp);
        dex.removeLiquidity(shares, 0, 0);
        require(lp.balance > zqBefore, "zq_return");
        require(token.balanceOf(lp) > tokenBefore, "token_return");
        require(dex.balanceOf(lp)==supplyBefore-shares,"provider_shares_burned");
        require(dex.totalSupply()==supplyBefore-shares,"supply_burned");
    }
}
