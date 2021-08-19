# AMM Construction

## Fees

Fees are invested in a vault. Then **new liquidity provider mint less token** if there are fees in the vault.

For now ETH fees are substracted to the ETH put in liquidity. But it **can cause underflow problems!** (need to find another way to calculate the minted amount and the equivalent when LPs are burned)
