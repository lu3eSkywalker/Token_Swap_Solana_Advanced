use crate::state::token_mint_metadata::TokenMintMetadata;
use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;
pub use contexts::accounts::*;

use instructions::*;

declare_id!("3jNvySAt5zc2qsePngwS4r93JkaWbhQmy1yUQaoSLXjZ");

#[program]
pub mod Simple_Token_Swap {
    use super::*;

    pub fn initialize_vault_token_a(ctx: Context<InitializeVaultTokenA>) -> Result<()> {
        instructions::initialize::initialize_vault_token_a(ctx)
    }

    pub fn initialize_vault_token_b(ctx: Context<InitializeVaultTokenB>) -> Result<()> {
        instructions::initialize::initialize_vault_token_b(ctx)
    }

    pub fn initialize_user_liquidity_account(
        ctx: Context<InitializeUserLiquidityAccount>,
    ) -> Result<()> {
        instructions::initialize::initialize_user_liquidity_account(ctx)
    }

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        metadata: TokenMintMetadata,
    ) -> Result<()> {
        instructions::create_token_mint::create_token_mint(ctx, metadata)
    }

    pub fn addLiquidity(ctx: Context<Liquidity>, tokenAmount: u64) -> Result<()> {
        instructions::add_liquidity::addLiquidity(ctx, tokenAmount)
    }

    pub fn removeLiquidity(ctx: Context<Liquidity>, tokenAmount: u64) -> Result<()> {
        instructions::remove_liquidity::removeLiquidity(ctx, tokenAmount)
    }

    pub fn swap_b_for_a(ctx: Context<TokenSwap>, amountOfTokenB: u64, minExpectedOutput: u64) -> Result<()> {
        instructions::swap_b::swap_b_for_a(ctx, amountOfTokenB, minExpectedOutput)
    }

    pub fn swap_a_for_b(ctx: Context<TokenSwap>, amountOfTokenA: u64, minExpectedOutput: u64) -> Result<()> {
        instructions::swap_a::swap_a_for_b(ctx, amountOfTokenA, minExpectedOutput)
    }
}