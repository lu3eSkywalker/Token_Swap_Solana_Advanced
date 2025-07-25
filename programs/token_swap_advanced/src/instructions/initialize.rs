use crate::contexts::{
    InitializeUserLiquidityAccount, InitializeVaultTokenA, InitializeVaultTokenB,
};
use crate::state::liquidity_account::LiquidityAccount;
use anchor_lang::prelude::*;

pub fn initialize_vault_token_a(ctx: Context<InitializeVaultTokenA>) -> Result<()> {
    Ok(())
}

pub fn initialize_vault_token_b(ctx: Context<InitializeVaultTokenB>) -> Result<()> {
    Ok(())
}

pub fn initialize_user_liquidity_account(
    ctx: Context<InitializeUserLiquidityAccount>,
) -> Result<()> {
    msg!("Liquidity account created successfully");

    let pda = &mut ctx.accounts.user_pda_account;
    pda.Owner = ctx.accounts.user.key();
    pda.stakedTokenAmount = 0;

    Ok(())
}