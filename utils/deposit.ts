import { logGasUsage } from "./gas";
import { expandDecimals, bigNumberify } from "./math";
import { executeWithOracleParams } from "./exchange";
import { contractAt } from "./deploy";
import { TOKEN_ORACLE_TYPES } from "./oracle";

export async function createDeposit(fixture, overrides: any = {}) {
  const { depositStore, depositHandler, weth, ethUsdMarket } = fixture.contracts;
  const { wallet, user0 } = fixture.accounts;

  const account = overrides.account || user0;
  const receiver = overrides.receiver || account;
  const callbackContract = overrides.callbackContract || { address: ethers.constants.AddressZero };
  const market = overrides.market || ethUsdMarket;
  const minMarketTokens = overrides.minMarketTokens || bigNumberify(0);
  const shouldConvertETH = overrides.shouldConvertETH || false;
  const executionFee = overrides.executionFee || "1000000000000000";
  const callbackGasLimit = overrides.callbackGasLimit || bigNumberify(0);
  const longTokenAmount = overrides.longTokenAmount || bigNumberify(0);
  const shortTokenAmount = overrides.shortTokenAmount || bigNumberify(0);

  await weth.mint(depositStore.address, executionFee);

  if (longTokenAmount.gt(0)) {
    const longToken = await contractAt("MintableToken", market.longToken);
    await longToken.mint(depositStore.address, longTokenAmount);
  }

  if (shortTokenAmount.gt(0)) {
    const shortToken = await contractAt("MintableToken", market.shortToken);
    await shortToken.mint(depositStore.address, shortTokenAmount);
  }

  const params = {
    receiver: receiver.address,
    callbackContract: callbackContract.address,
    market: market.marketToken,
    minMarketTokens,
    shouldConvertETH,
    executionFee,
    callbackGasLimit,
  };

  await logGasUsage({
    tx: depositHandler.connect(wallet).createDeposit(account.address, params),
    label: overrides.gasUsageLabel,
  });
}

export async function executeDeposit(fixture, overrides: any = {}) {
  const { depositStore, depositHandler, weth, usdc } = fixture.contracts;
  const { gasUsageLabel } = overrides;
  const tokens = overrides.tokens || [weth.address, usdc.address];
  const tokenOracleTypes = overrides.tokenOracleTypes || [TOKEN_ORACLE_TYPES.DEFAULT, TOKEN_ORACLE_TYPES.DEFAULT];
  const precisions = overrides.precisions || [8, 18];
  const minPrices = overrides.minPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];
  const maxPrices = overrides.maxPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];
  const depositKeys = await depositStore.getDepositKeys(0, 1);
  const deposit = await depositStore.get(depositKeys[0]);

  const params = {
    key: depositKeys[0],
    oracleBlockNumber: deposit.updatedAtBlock,
    tokens,
    tokenOracleTypes,
    precisions,
    minPrices,
    maxPrices,
    execute: depositHandler.executeDeposit,
    gasUsageLabel,
  };

  await executeWithOracleParams(fixture, params);
}

export async function handleDeposit(fixture, overrides: any = {}) {
  await createDeposit(fixture, overrides.create);
  await executeDeposit(fixture, overrides.execute);
}
