use anchor_lang::prelude::*;

#[account]
pub struct LiquidityAccount {
    pub Owner: Pubkey,
    pub stakedTokenAmount: u64,
    pub last_update_time: i64,
}