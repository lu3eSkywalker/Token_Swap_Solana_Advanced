use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct TokenMintMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}