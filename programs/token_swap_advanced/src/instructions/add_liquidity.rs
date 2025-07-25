use crate::contexts::Liquidity;
use crate::state::liquidity_account::LiquidityAccount;
use crate::utils::transfer::deposit_to_vault_token_a;
use crate::utils::transfer::deposit_to_vault_token_b;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

pub fn addLiquidity(ctx: Context<Liquidity>, tokenAmount: u64) -> Result<()> {
    deposit_to_vault_token_a(
        &ctx.accounts.user.to_account_info(),
        &ctx.accounts.user_token_account_for_token_a,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.token_program,
        tokenAmount,
    )?;

    deposit_to_vault_token_b(
        &ctx.accounts.user.to_account_info(),
        &ctx.accounts.user_token_account_for_token_b,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.token_program,
        tokenAmount,
    )?;

    // Minting Tokens
    let signer_seeds: &[&[&[u8]]] = &[&[b"authority", &[ctx.bumps.authority]]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    mint_to(cpi_ctx, tokenAmount)?;

    msg!("Minted LP Tokens Successfully");

    let clock = Clock::get()?;

    let pda = &mut ctx.accounts.user_pda_account;
    pda.stakedTokenAmount += tokenAmount;
    pda.last_update_time = clock.unix_timestamp;

    msg!("Liquidity Added Successfully");

    Ok(())
}
