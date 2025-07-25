use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, InitializeAccount, Mint, Token, TokenAccount, TokenAccount as SPLTokenAccount, Transfer,
};

// This function deposits the Token A from user to the token vault
pub fn deposit_to_vault_token_a<'info>(
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
pub fn deposit_to_vault_token_b<'info>(
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
pub fn send_token_a_from_token_vault_to_user<'info>(
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
pub fn send_token_b_from_token_vault_to_user<'info>(
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