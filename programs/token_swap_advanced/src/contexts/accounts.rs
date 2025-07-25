use crate::state::liquidity_account::LiquidityAccount;
use crate::state::token_mint_metadata::TokenMintMetadata;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, InitializeAccount, TokenAccount as SPLTokenAccount, Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction()]
pub struct InitializeVaultTokenA<'info> {
    #[account(
        init_if_needed,
        seeds = [b"vaultTokenA", mint.key().as_ref()],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = vault_auth
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA will be the authority for the vault PDA
    #[account{
        seeds = [b"vaultTokenA", mint.key().as_ref()],
        bump
    }]
    pub vault_auth: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeVaultTokenB<'info> {
    #[account(
        init_if_needed,
        seeds = [b"vaultTokenB", mint.key().as_ref()],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = vault_auth
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA will be the authority for the vault PDAs
    #[account{
        seeds = [b"vaultTokenB", mint.key().as_ref()],
        bump
    }]
    pub vault_auth: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeUserLiquidityAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8,
        seeds = [b"userliquidityPDA", user.key().as_ref()],
        bump
    )]
    pub user_pda_account: Account<'info, LiquidityAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: TokenMintMetadata)]
pub struct CreateTokenMint<'info> {
    /// CHECK: PDA derived from [b"metadata", metadata_program_id, mint]
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [b"mint"],
        bump,
        mint::decimals = params.decimals,
        mint::authority = authority.key(),
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA that controls the mint
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
pub struct Liquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"userliquidityPDA", user.key().as_ref()],
        bump
    )]
    pub user_pda_account: Account<'info, LiquidityAccount>,

    #[account(mut)]
    pub user_token_account_for_token_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account_for_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vaultTokenA", mint_a.key().as_ref()],
        bump
    )]
    pub vault_token_a_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vaultTokenB", mint_b.key().as_ref()],
        bump
    )]
    pub vault_token_b_account: Account<'info, TokenAccount>,

    /// CHECK: This is just a signer PDA, no data
    #[account(
        seeds = [b"vaultTokenA", mint_a.key().as_ref()],
        bump
    )]
    pub vault_auth_a: AccountInfo<'info>,

    /// CHECK: This is just a signer PDA, no data
    #[account(
        seeds = [b"vaultTokenB", mint_b.key().as_ref()],
        bump
    )]
    pub vault_auth_b: AccountInfo<'info>,

    pub mint_a: Account<'info, Mint>,

    pub mint_b: Account<'info, Mint>,

    // For Minting LP Tokens
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK
    #[account(
        seeds = [b"authority"],
        bump
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = destination_owner,
    )]
    pub destination: Account<'info, TokenAccount>,

    /// CHECK: we use this to validate token owner
    pub destination_owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct TokenSwap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account_for_token_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account_for_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vaultTokenA", mint_a.key().as_ref()],
        bump
    )]
    pub vault_token_a_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vaultTokenB", mint_b.key().as_ref()],
        bump
    )]
    pub vault_token_b_account: Account<'info, TokenAccount>,

    /// CHECK: This is just a signer PDA, no data
    #[account(
        seeds = [b"vaultTokenA", mint_a.key().as_ref()],
        bump
    )]
    pub vault_auth_a: AccountInfo<'info>,

    /// CHECK: This is just a signer PDA, no data
    #[account(
        seeds = [b"vaultTokenB", mint_b.key().as_ref()],
        bump
    )]
    pub vault_auth_b: AccountInfo<'info>,

    pub mint_a: Account<'info, Mint>,

    pub mint_b: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}