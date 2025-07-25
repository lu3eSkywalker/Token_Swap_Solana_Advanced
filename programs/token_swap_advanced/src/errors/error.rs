use anchor_lang::prelude::*;

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