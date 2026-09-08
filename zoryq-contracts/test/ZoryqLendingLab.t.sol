// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ZoryqLendingLab.sol";
import "../src/ZoryqTestToken.sol";

interface VmLending {
    function deal(address who, uint256 newBalance) external;
    function prank(address who) external;
    function startPrank(address who) external;
    function stopPrank() external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes calldata) external;
}

contract ZoryqLendingLabTest {
    VmLending constant vm = VmLending(address(uint160(uint256(keccak256("hevm cheat code")))));

    ZoryqTestToken token;
    ZoryqLendingLab lending;

    address supplier = address(0x5100);
    address borrower = address(0xB011);
    address liquidator = address(0x1A11);
    address stranger = address(0xBAD);

    function setUp() public {
        token = new ZoryqTestToken("ZORYQ Test USD", "zUSD", 0, address(this), address(this));
        lending = new ZoryqLendingLab(address(token));

        token.mint(supplier, 100_000 ether);
        token.mint(liquidator, 100_000 ether);
        vm.deal(borrower, 100 ether);
        vm.deal(liquidator, 10 ether);

        vm.startPrank(supplier);
        token.approve(address(lending), type(uint256).max);
        lending.supplyLiquidity(50_000 ether);
        vm.stopPrank();
    }

    function _depositAndBorrow(uint256 collateral, uint256 debt) internal {
        vm.startPrank(borrower);
        lending.deposit{value: collateral}();
        lending.borrow(debt);
        token.approve(address(lending), type(uint256).max);
        vm.stopPrank();
    }

    function testDepositAndBorrowRespectsLtv() public {
        vm.prank(borrower);
        lending.deposit{value: 10 ether}();
        require(lending.maxBorrow(borrower) == 5 ether, "max_borrow");
        require(lending.availableToBorrow(borrower) == 5 ether, "available");

        vm.prank(borrower);
        lending.borrow(5 ether);
        require(token.balanceOf(borrower) == 5 ether, "borrowed_balance");
        require(lending.availableToBorrow(borrower) == 0, "borrow_limit_used");

        vm.prank(borrower);
        vm.expectRevert(bytes("ltv_exceeded"));
        lending.borrow(1);
    }

    function testInterestAccruesOverTime() public {
        _depositAndBorrow(20 ether, 5 ether);
        uint256 initial = lending.accruedDebt(borrower);
        vm.warp(block.timestamp + 365 days);
        uint256 afterYear = lending.accruedDebt(borrower);
        require(initial == 5 ether, "initial_debt");
        require(afterYear == 5.25 ether, "annual_interest");
    }

    function testHealthyWithdrawalCannotBreakLtv() public {
        _depositAndBorrow(10 ether, 5 ether);
        vm.prank(borrower);
        vm.expectRevert(bytes("ltv_exceeded"));
        lending.withdraw(1 ether);
    }

    function testRepayReducesDebtAndAllowsCollateralWithdrawal() public {
        _depositAndBorrow(10 ether, 4 ether);
        uint256 borrowerTokenBefore = token.balanceOf(borrower);
        vm.prank(borrower);
        lending.repay(2 ether);
        require(lending.accruedDebt(borrower) == 2 ether, "debt_reduced");
        require(token.balanceOf(borrower) == borrowerTokenBefore - 2 ether, "repay_transfer");

        uint256 zqBefore = borrower.balance;
        vm.prank(borrower);
        lending.withdraw(5 ether);
        require(borrower.balance == zqBefore + 5 ether, "collateral_returned");
    }

    function testSupplierAccountingAndWithdrawal() public {
        require(lending.suppliedZUSD(supplier) == 50_000 ether, "supplier_total");
        require(lending.totalSuppliedZUSD() == 50_000 ether, "global_total");
        uint256 before = token.balanceOf(supplier);
        vm.prank(supplier);
        lending.withdrawLiquidity(10_000 ether);
        require(lending.suppliedZUSD(supplier) == 40_000 ether, "supplier_remaining");
        require(lending.totalSuppliedZUSD() == 40_000 ether, "global_remaining");
        require(token.balanceOf(supplier) == before + 10_000 ether, "liquidity_returned");
    }

    function testLiquidationAfterPriceDrop() public {
        _depositAndBorrow(10 ether, 5 ether);
        lending.setRiskParameters(0.5 ether, 5000, 7500, 500, 500);
        require(lending.liquidatable(borrower), "must_be_liquidatable");

        vm.startPrank(liquidator);
        token.approve(address(lending), type(uint256).max);
        uint256 zqBefore = liquidator.balance;
        lending.liquidate(borrower, 2 ether);
        vm.stopPrank();

        require(lending.accruedDebt(borrower) == 3 ether, "debt_after_liquidation");
        require(liquidator.balance > zqBefore, "liquidator_reward");
    }

    function testRiskAndPauseAreOwnerControlled() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("not_owner"));
        lending.setRiskParameters(1 ether, 4000, 7000, 300, 400);

        lending.setPaused(true);
        vm.prank(borrower);
        vm.expectRevert(bytes("paused"));
        lending.deposit{value: 1 ether}();

        lending.setPaused(false);
        vm.prank(borrower);
        lending.deposit{value: 1 ether}();
        require(lending.positions(borrower).collateralZQ == 1 ether, "unpaused_deposit");
    }

    function testOwnershipTransferChangesAuthority() public {
        lending.transferOwnership(stranger);
        vm.expectRevert(bytes("not_owner"));
        lending.setPaused(true);
        vm.prank(stranger);
        lending.setPaused(true);
        require(lending.paused(), "new_owner_control");
    }
}
