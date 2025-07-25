use anchor_lang::prelude::*;
use crate::errors::error::TokenSwapError;

pub fn amm_calculation(token_a_quantity: u64, token_b_quantity: u64) -> Result<(u128)> {
    let token_a_128 = token_a_quantity as u128;
    let token_b_128 = token_b_quantity as u128;

    let x = token_a_128
        .checked_mul(token_b_128)
        .ok_or_else(|| error!(TokenSwapError::CalculationError))?;

    Ok(x)
}