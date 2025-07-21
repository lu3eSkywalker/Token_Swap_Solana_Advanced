use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, InitializeAccount, TokenAccount as SPLTokenAccount, Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use solana_program::system_instruction;

declare_id!("AgMtyNJ7yW95Njgn3GBH8zvJCNd7bourbLEfSqo1LNkh");

#[program]
pub mod Simple_Token_Swap {
    use super::*;

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

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        metadata: TokenMintMetadata,
    ) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[b"authority", &[ctx.bumps.authority]]];

        let token_data = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;
        Ok(())
    }

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

    pub fn removeLiquidity(ctx: Context<Liquidity>, tokenAmount: u64) -> Result<()> {
        let pda_account_time = &ctx.accounts.user_pda_account;

        let current_time = Clock::get()?;

        require!(
            current_time.unix_timestamp - pda_account_time.last_update_time >= 100,
            TokenSwapError::TimeConstraint
        );

        let userProvidedLiquidity = &mut ctx.accounts.user_pda_account;

        require!(
            userProvidedLiquidity.stakedTokenAmount >= tokenAmount,
            TokenSwapError::InsufficientLiquidityTokens
        );

        send_token_a_from_token_vault_to_user(
            &ctx.accounts.mint_a,
            &ctx.accounts.vault_auth_a,
            &ctx.accounts.vault_token_a_account,
            &ctx.accounts.user_token_account_for_token_a,
            &ctx.accounts.token_program,
            ctx.bumps.vault_auth_a,
            tokenAmount,
        )?;

        send_token_b_from_token_vault_to_user(
            &ctx.accounts.mint_b,
            &ctx.accounts.vault_auth_b,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.user_token_account_for_token_b,
            &ctx.accounts.token_program,
            ctx.bumps.vault_auth_b,
            tokenAmount,
        )?;

        userProvidedLiquidity.stakedTokenAmount -= tokenAmount;

        Ok(())
    }

    pub fn swap_b_for_a(ctx: Context<TokenSwap>, amountOfTokenB: u64, minExpectedOutput: u64) -> Result<()> {

        let token_a_quantity = ctx.accounts.vault_token_a_account.amount;
        let token_b_quantity = ctx.accounts.vault_token_b_account.amount;

        let (x) = amm_calculation(token_a_quantity, token_b_quantity)?;

        let tokenAToSend = (x / ((token_b_quantity as u128) + (amountOfTokenB as u128)))
            .try_into()
            .map_err(|_| error!(TokenSwapError::CalculationError))?;

        let tokenAtoGive = (token_a_quantity as u128)
            .checked_sub(tokenAToSend)
            .ok_or(error!(TokenSwapError::CalculationError))?;

        let tokenA_Swap_Fees = tokenAtoGive * 3 / 100;

        let tokenA_With_Swap_Fees = tokenAtoGive - tokenA_Swap_Fees;

        require!(
            tokenA_With_Swap_Fees <= token_a_quantity as u128,
            TokenSwapError::InsufficientTokenA
        );

        require!(
            tokenA_With_Swap_Fees >= minExpectedOutput as u128,
            TokenSwapError::SlippageExceeded
        );

        // Transfer Token B from user to Token Vault
        deposit_to_vault_token_b(
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.user_token_account_for_token_b,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.token_program,
            amountOfTokenB,
        )?;

        // Convert to u64 before transferring
        let tokenA_With_Swap_Fees: u64 = tokenA_With_Swap_Fees
            .try_into()
            .map_err(|_| error!(TokenSwapError::CalculationError))?;

        // Transfer Token A from Token Vault to user
        send_token_a_from_token_vault_to_user(
            &ctx.accounts.mint_a,
            &ctx.accounts.vault_auth_a,
            &ctx.accounts.vault_token_a_account,
            &ctx.accounts.user_token_account_for_token_a,
            &ctx.accounts.token_program,
            ctx.bumps.vault_auth_a,
            tokenA_With_Swap_Fees,
        )?;

        Ok(())
    }

    pub fn swap_a_for_b(ctx: Context<TokenSwap>, amountOfTokenA: u64, minExpectedOutput: u64) -> Result<()> {
        let token_a_quantity = ctx.accounts.vault_token_a_account.amount;
        let token_b_quantity = ctx.accounts.vault_token_b_account.amount;

        let swapFees = 0.3;

        let (x) = amm_calculation(token_a_quantity, token_b_quantity)?;

        let tokenBtoSend = (x / ((token_a_quantity as u128) + (amountOfTokenA as u128)))
            .try_into()
            .map_err(|_| error!(TokenSwapError::CalculationError))?;

        let tokenBtoGive = (token_b_quantity as u128)
            .checked_sub(tokenBtoSend)
            .ok_or(error!(TokenSwapError::CalculationError))?;

        let tokenB_Swap_Fees = tokenBtoGive * 3 / 100;

        let tokenB_With_Swap_Fees = tokenBtoGive - tokenB_Swap_Fees;

        require!(
            tokenB_With_Swap_Fees <= token_b_quantity as u128,
            TokenSwapError::InsufficientTokenB
        );

        require!(
            tokenB_With_Swap_Fees >= minExpectedOutput as u128,
            TokenSwapError::SlippageExceeded
        );

        // Transfer Token A from user to Token Vault
        deposit_to_vault_token_a(
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.user_token_account_for_token_a,
            &ctx.accounts.vault_token_a_account,
            &ctx.accounts.token_program,
            amountOfTokenA,
        )?;

        // Convert to u64 before transferring
        let tokenB_With_Swap_Fees: u64 = tokenB_With_Swap_Fees
            .try_into()
            .map_err(|_| error!(TokenSwapError::CalculationError))?;

        // Transfer Token B from Token Vault to user

        send_token_b_from_token_vault_to_user(
            &ctx.accounts.mint_b,
            &ctx.accounts.vault_auth_b,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.user_token_account_for_token_b,
            &ctx.accounts.token_program,
            ctx.bumps.vault_auth_b,
            tokenB_With_Swap_Fees,
        )?;

        Ok(())
    }
}

fn amm_calculation(token_a_quantity: u64, token_b_quantity: u64) -> Result<(u128)> {
    let token_a_128 = token_a_quantity as u128;
    let token_b_128 = token_b_quantity as u128;

    let x = token_a_128
        .checked_mul(token_b_128)
        .ok_or_else(|| error!(TokenSwapError::CalculationError))?;

    Ok(x)
}

// This function deposits the Token A from user to the token vault
fn deposit_to_vault_token_a<'info>(
    user: &AccountInfo<'info>,
    user_token_account_for_token_a: &Account<'info, TokenAccount>,
    vault_token_a_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: user_token_account_for_token_a.to_account_info(),
        to: vault_token_a_account.to_account_info(),
        authority: user.clone(),
    };

    let cpi_program = token_program.to_account_info();

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

// This function deposits the Token B from user to the token vault
fn deposit_to_vault_token_b<'info>(
    user: &AccountInfo<'info>,
    user_token_account_for_token_b: &Account<'info, TokenAccount>,
    vault_token_b_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: user_token_account_for_token_b.to_account_info(),
        to: vault_token_b_account.to_account_info(),
        authority: user.to_account_info(),
    };

    let cpi_program = token_program.to_account_info();

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

// This function sends token A from Token Vault to User
fn send_token_a_from_token_vault_to_user<'info>(
    mint_a: &Account<'info, Mint>,
    vault_auth_a: &AccountInfo<'info>,
    vault_token_a_account: &Account<'info, TokenAccount>,
    user_token_account_for_token_a: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    vault_auth_a_bump: u8,
    tokenAmount: u64,
) -> Result<()> {
    let mint_a_key = mint_a.key();

    let seeds = &[b"vaultTokenA", mint_a_key.as_ref(), &[vault_auth_a_bump]];

    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: vault_token_a_account.to_account_info(),
        to: user_token_account_for_token_a.to_account_info(),
        authority: vault_auth_a.to_account_info(),
    };

    let cpi_program = token_program.to_account_info();

    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    token::transfer(cpi_ctx, tokenAmount);

    Ok(())
}

// This function sends token B from Token Vault to User
fn send_token_b_from_token_vault_to_user<'info>(
    mint_b: &Account<'info, Mint>,
    vault_auth_b: &AccountInfo<'info>,
    vault_token_b_account: &Account<'info, TokenAccount>,
    user_token_account_for_token_b: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    vault_auth_b_bump: u8,
    tokenAmount: u64,
) -> Result<()> {
    let mint_b_key = mint_b.key();

    let seeds = &[b"vaultTokenB", mint_b_key.as_ref(), &[vault_auth_b_bump]];

    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: vault_token_b_account.to_account_info(),
        to: user_token_account_for_token_b.to_account_info(),
        authority: vault_auth_b.to_account_info(),
    };

    let cpi_program = token_program.to_account_info();

    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    token::transfer(cpi_ctx, tokenAmount);

    Ok(())
}

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

#[account]
pub struct LiquidityAccount {
    pub Owner: Pubkey,
    pub stakedTokenAmount: u64,
    pub last_update_time: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct TokenMintMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

#[error_code]
pub enum TokenSwapError {
    #[msg("Insufficient amount of token A in the liquidity pool")]
    InsufficientTokenA,

    #[msg("Insufficient amount of token B in the liquidity pool")]
    InsufficientTokenB,

    #[msg("Multiplication overflow in calculation error")]
    CalculationError,

    #[msg("Insufficient amount of tokens provided in the liquidity pool")]
    InsufficientLiquidityTokens,

    #[msg("Time Constraint, Can't remove liquidity before 10 days")]
    TimeConstraint,

    #[msg("Slippage Exceeded")]
    SlippageExceeded
}