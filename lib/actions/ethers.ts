import { ethers, formatEther, formatUnits, parseUnits, Contract, getBigInt, toNumber } from "ethers";
import contractsJSON from "@/web3ABIs/ethereum/contractABIsERC721Sales.json";
if (contractsJSON.length != 4) console.error("contractsJSON length must be 4")
export const contractsJSONdup = contractsJSON;
export const erc20JSON = contractsJSON[0];
export const erc721JSON = contractsJSON[1];
export const salesJSON = contractsJSON[2];
export const ArrayOfStructsJSON = contractsJSON[3];
import { asyncFor, capitalizeFirst, isEmpty } from "@/lib/utils";
import { Web3InitOutT, balancesT, initBalancesDefault, web3InitDefault } from "@/store/web3Store";
import { number } from "zod";

const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_APIKEY || '';
const ethereumNetwork = process.env.NEXT_PUBLIC_ETHEREUM_NETWORK || 'anvil';
const erc20_usdtAddr = process.env.NEXT_PUBLIC_ETHEREUM_USDT || erc20JSON.contractAddress;
const erc20_usdcAddr = process.env.NEXT_PUBLIC_ETHEREUM_USDC || '';
const erc721Addr = process.env.NEXT_PUBLIC_ETHEREUM_NFT || erc721JSON.contractAddress;
const salesAddr = process.env.NEXT_PUBLIC_ETHEREUM_NFTSALES || salesJSON.contractAddress;

let signer: any = undefined;
let provider: any = undefined;
let isInitialized = false;
const lg = console.log;
let mesg = '', warning = '';
export const bigIntZero = BigInt(0)

export type OutT = {
  err: string
  str1: string
  inWei: bigint
  nums: number[]
}
export let out: OutT = { err: '', str1: '', inWei: bigIntZero, nums: [] }
declare global {
  interface Window {
    ethereum: any
  }
}

export const ethersDefaultProvider = async (): Promise<Web3InitOutT> => {
  const funcName = "ethersDefaultProvider";
  lg(funcName + "()...");
  const ethereumNetworkRaw = process.env.NEXT_PUBLIC_ETHEREUM_NETWORK;
  let chainId = ''
  let chainName = ''
  if (ethereumNetworkRaw) {
    // set to remote default network
    mesg = "Use read-only defaults on " + ethereumNetworkRaw + " test network";
    const infuraEndpoint = "https://" + ethereumNetworkRaw + ".infura.io/v3/" + infuraApiKey;
    lg("infuraEndpoint", infuraEndpoint)
    provider = new ethers.JsonRpcProvider(infuraEndpoint);
    const chainObj = getChainObj(ethereumNetworkRaw);
    chainId = chainObj.chainId;
    chainName = chainObj.chainName;
  } else {
    // set to local default network
    const localEndpoint = "http://localhost:8545";
    lg("localEndpoint", localEndpoint)
    provider = new ethers.JsonRpcProvider(localEndpoint);
    chainId = 'local'
    chainName = 'local'
  }
  //signer = await provider.getSigner()
  lg('use default chainId:', chainId);
  lg('use default chainName:', chainName);
  if (chainName !== ethereumNetwork && process.env.NEXT_PUBLIC_ETHEREUM_NETWORK) {
    warning = 'use default chain ' + capitalizeFirst(chainName) + ' is not expected. Switch network to ' + capitalizeFirst(ethereumNetwork);
  }
  const account = '';
  lg('use null account:', account);

  if (warning) console.warn(warning)
  lg(funcName + " ran successfully")
  return {
    ...web3InitDefault,
    chainType: 'evm',
    chainId,
    chainName,
    account,
    warn: warning,
  };
}
export const checkEvmWalletAfterLoad = async () =>
  window.addEventListener('load', async () => {
    let initOut = web3InitDefault;
    try {
      initOut = await initializeEvmWallet();
    } catch (err: any) {
      console.error('@initializeEvmWallet:', err);
      return { ...web3InitDefault, err: err.message };
    }
  });
export const initializeEvmWallet = async (): Promise<Web3InitOutT> => {
  const funcName = "initializeEvmWallet";
  lg(funcName + "()...");
  if (window.ethereum == null) {
    // If MetaMask is not installed, we use the default provider, which is backed by a variety of third-party services (such as INFURA). They do not have private keys installed so are only have read-only access
    warning = "MetaMask not installed; using read-only defaults on sepolia test network";
    console.warn(warning)
    provider = ethers.getDefaultProvider("sepolia");
    return {
      ...web3InitDefault,
      warn: warning,
      chainId: '11155111',//sepolia
      chainName: 'sepolia',
    };
  } else {
    // Connect to the MetaMask EIP-1193 object. This is a standard protocol that allows Ethers access to make all read-only requests through MetaMask.
    provider = new ethers.BrowserProvider(window.ethereum)
    //import { InfuraProvider } from "ethers"

    // It also provides an opportunity to request access to write operations, which will be performed by the private key that MetaMask manages for the user.
    signer = await provider.getSigner();

    //https://docs.metamask.io/wallet/get-started/set-up-dev-environment/
    const chainId = await window.ethereum.request({ method: 'eth_chainId' }).catch((err: any) => {
      mesg = '@eth_chainId:' + err;
      console.error(mesg);
      return { ...web3InitDefault, err: mesg };
    });
    lg('detected chainId:', chainId);
    const { chainHex, chainName } = getChainObj(chainId)
    lg('detected chainName:', chainName);

    if (chainName !== ethereumNetwork) {
      warning = 'detected chain ' + capitalizeFirst(chainName) + ' is not expected. Switch network to ' + capitalizeFirst(ethereumNetwork);
    }

    const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch((err: any) => {
      mesg = '@eth_accounts:' + err;
      console.error(mesg);
      return { ...web3InitDefault, err: mesg };
    });
    lg('detected accounts:', accounts);//same as account with only one item in the array
    const out = handleAccountsChanged(accounts);
    if (out.warn) {
      return { ...web3InitDefault, warn: out.warn }
    }
    const account = out.account;
    lg('detected account:', account);

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    if (warning) console.warn(warning)
    lg(funcName + " ran successfully")
    return {
      ...web3InitDefault,
      chainId,
      chainName,
      account,
      warn: warning
    };
  }
}
const handleChainChanged = () => {
  window.location.reload();
}
function handleAccountsChanged(accounts: string | any[]): Web3InitOutT {
  let currentAccount = null;
  if (accounts.length === 0) {
    warning = 'Please connect to MetaMask';
    console.warn(warning);
    return { ...web3InitDefault, warn: warning };
  } else if (accounts[0] !== currentAccount) {
    currentAccount = accounts[0];
    lg('currentAccount', currentAccount);
    if (isInitialized) {
      window.location.reload();
    }
    isInitialized = true;
  }
  return { ...web3InitDefault, account: currentAccount };
}

export async function getAccount(): Promise<Partial<Web3InitOutT>> {
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    .catch((err: any) => {
      if (err.code === 4001) {
        warning = 'Please connect to MetaMask';
        console.warn(warning);
        return { warn: warning };
      } else {
        console.error(err);
        return { err };
      }
    });
  const account = accounts[0];
  lg('getAccount() success. account:', account);
  return { account };
}

export const getBalanceEth = async (addr: string): Promise<OutT> => {
  const funcName = 'getBalanceEth';
  lg(funcName + '()... addr:', addr);
  if (isEmpty(addr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const balanceInWei: bigint = await provider.getBalance(addr);// 182334002436162568n

    const balanceInEth = formatEther(balanceInWei);
    // '0.182334002436162568'
    lg(funcName + ' success:', balanceInWei, balanceInEth);
    return {
      ...out,
      str1: balanceInEth,
      inWei: balanceInWei,
    };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc20BalanceOf = async (addrTarget: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = "erc20BalanceOf";
  lg(funcName + '()... addrTarget:', addrTarget, ', ctrtAddr:', ctrtAddr);
  if (isEmpty(addrTarget) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const token = new Contract(ctrtAddr, erc20JSON.abi, provider);
    const tokenBalcInWei: bigint = await token.balanceOf(addrTarget);
    const decimals = getDecimals(ctrtAddr);
    const tokenBalcStr = formatUnits(tokenBalcInWei, decimals);
    lg(funcName + ' success:', tokenBalcInWei, decimals, tokenBalcStr);
    return { ...out, str1: tokenBalcStr, inWei: tokenBalcInWei, nums: [decimals] };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}
const erc20DataDefault = { err: '', name: '', symbol: '', decimals: -1 }
export const erc20Data = async (ctrtAddr: string) => {
  const funcName = "erc20Data";
  lg(funcName + '()... ctrtAddr:', ctrtAddr);
  if (isEmpty(ctrtAddr)) {
    return { ...erc20DataDefault, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...erc20DataDefault, err: 'provider invalid' };
  }
  try {
    const token = new Contract(ctrtAddr, erc20JSON.abi, provider);
    const name: string = await token.name();
    const symbol: string = await token.symbol();
    const decimals: bigint = await token.decimals();
    /*  const out = await token.getData(addrTarget);
        lg("getData out:", out);
        const { 0: sym, 1: decimals, 2: tokenBalcInWei } = out;*/
    lg("name:", name, ", symbol:", symbol, ", decimals:", decimals, toNumber(decimals));
    lg(funcName + ' success');
    return { ...erc20DataDefault, name, symbol, decimals: toNumber(decimals) };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...erc20DataDefault, err: funcName + ' failed' };
  }
}

export const erc20Allowance = async (addrFrom: string, addrTo: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc20Allowance';
  lg(funcName + '()... addrFrom:', addrFrom, ', addrTo:', addrTo);
  if (isEmpty(addrFrom) || isEmpty(addrTo) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const token = new Contract(ctrtAddr, erc20JSON.abi, provider);

    const allowanceInWei: bigint = await token.allowance(addrFrom, addrTo);
    const decimals = await token.decimals();// 18n
    const allowanceInEth = formatUnits(allowanceInWei, decimals);

    lg(funcName + ' success:', allowanceInWei, allowanceInEth);
    return { ...out, str1: allowanceInEth, inWei: allowanceInWei };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc20Transfer = async (addrTo: string, amount: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc20Transfer';
  lg(funcName + '()... addrTo:', addrTo, ', amount:', amount, ', ctrtAddr:', ctrtAddr);
  if (isEmpty(addrTo) || isEmpty(amount) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const token = new Contract(ctrtAddr, erc20JSON.abi, signer);
    const amountInWei = parseUnits(amount, 18);
    const tx = await token.transfer(addrTo, amountInWei);
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //receipt has properties of provider, to, from, index: number, blockHash, blockNumber: number, logsBloom, cumulativeGasUsed: bigint, gasPrice: bigint, gasUsed: bigint
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc20Approve = async (addrTo: string, amount: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc20Approve';
  lg(funcName + '()... addrTo:', addrTo, ', amount:', amount, ', ctrtAddr:', ctrtAddr);
  if (isEmpty(addrTo) || isEmpty(amount) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const token = new Contract(ctrtAddr, erc20JSON.abi, signer);
    const amountInWei = parseUnits(amount, 18);
    const tx = await token.transfer(addrTo, amountInWei);
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //blockNumber, cumulativeGasUsed, gasPrice, gasUsed
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

//----------------== ERC721
export const erc721Transfer = async (addrFrom: string, addrTo: string, tokenId: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721Transfer'
  lg(funcName + '()... addrFrom:', addrFrom, ', addrTo:', addrTo, ', tokenId:', tokenId, ', ctrtAddr:', ctrtAddr);
  const tokId = Number.parseInt(tokenId);
  if (isEmpty(addrFrom) || isEmpty(addrTo) || isEmpty(tokenId) || isEmpty(ctrtAddr) || Number.isNaN(tokId)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, signer);
    const ownerOut = await nft.ownerOf(tokId);
    lg("ownerOut:", ownerOut)
    if (ownerOut !== addrFrom) console.warn("addrFrom is not the owner")

    const tx = await nft.safeTransferFrom(addrFrom, addrTo, tokId);
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //blockNumber, cumulativeGasUsed, gasPrice, gasUsed
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc721SafeMint = async (addrFrom: string, addrTo: string, tokenId: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = "erc721SafeMint";
  lg(funcName + '()... addrFrom:', addrFrom, ', addrTo:', addrTo, ', tokenId:', tokenId, ', ctrtAddr:', ctrtAddr);
  const tokId = Number.parseInt(tokenId);
  if (isEmpty(addrFrom) || isEmpty(addrTo) || isEmpty(tokenId) || isEmpty(ctrtAddr) || Number.isNaN(tokId)) {
    return { ...out, err: funcName + 'input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, signer);

    const ownerOut = await nft.owner();
    lg("ownerOut:", ownerOut)
    if (ownerOut.toLowerCase() !== addrFrom.toLowerCase()) return { ...out, err: 'invalid contract owner' }

    const isExisting: boolean = await nft.exists(tokId);
    lg("isExisting:", isExisting)
    if (isExisting) return { ...out, err: 'tokenId was already minted' }

    const tx = await nft.safeMint(addrTo, tokId);
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //blockNumber, cumulativeGasUsed, gasPrice, gasUsed
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc721BalanceOf = async (addrTarget: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721BalanceOf'
  lg(funcName + '()... addrTarget:', addrTarget, ', ctrtAddr:', ctrtAddr);
  if (isEmpty(addrTarget) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, provider);
    const tokenBalcInWei: bigint = await nft.balanceOf(addrTarget);
    lg(funcName + ' success,', tokenBalcInWei);
    return { ...out, inWei: tokenBalcInWei, str1: ethers.toNumber(tokenBalcInWei) + '' };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc721TokenURI = async (tokenId: number, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721TokenURI'
  lg(funcName + '()... tokenId:', tokenId, ', ctrtAddr:', ctrtAddr);
  if (tokenId < 0 || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, provider);
    const tokenURI: string = await nft.tokenURI(tokenId);
    lg(funcName + ' success,', tokenURI);
    return { ...out, str1: tokenURI };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}
export const erc721BaseURIDefault = {
  arr: [] as nftSalesStatus[],
  err: ''
}
export const erc721BaseURI = async (ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721TokenURI'
  lg(funcName + '()... ctrtAddr:', ctrtAddr);
  if (isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, provider);
    const baseURI: string = await nft.baseURI();
    lg(funcName + ' success,', baseURI);
    return { ...out, str1: baseURI };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc721OwnerOf = async (tokenId: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721OwnerOf'
  lg(funcName + '()... tokenId:', tokenId, ', ctrtAddr:', ctrtAddr, ', tokenId:', tokenId);
  if (isEmpty(tokenId) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, provider);
    const owner: string = await nft.ownerOf(tokenId);
    lg(funcName + ' success:', owner);
    return { ...out, str1: owner };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const erc721TokenIds = async (addrTarget: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = 'erc721TokenIds';
  lg(funcName + '()... addrTarget:', addrTarget, ', ctrtAddr:', ctrtAddr);
  if (isEmpty(addrTarget) || isEmpty(ctrtAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(ctrtAddr, erc721JSON.abi, provider);

    const balc: bigint = await nft.balanceOf(addrTarget);
    //lg('balanceOf:', balc);
    const balcNum = toNumber(balc);

    const arr = [] as number[];
    for (let i = 0; i < balcNum; i++) {
      const tokId: bigint = await nft.tokenOfOwnerByIndex(addrTarget, i);
      arr.push(toNumber(tokId));
      lg('i:', i, ', tokId:', tokId);
    }//tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256 tokenId);
    lg(funcName + ' success');
    return { ...out, str1: arr.toString() || "none", nums: arr };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}
//----------------== ERC721Sales Contract
const evmSalesTokenDataD = { ...erc20DataDefault, erc20Addr: '' }
export const evmSalesTokenData = async (salesAddr: string) => {
  const funcName = 'salesTokenData'
  lg(funcName + '()...');
  if (isEmpty(salesAddr)) {
    return { ...evmSalesTokenDataD, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...evmSalesTokenDataD, err: 'provider invalid' };
  }
  try {
    const sales = new Contract(salesAddr, salesJSON.abi, provider);
    const erc20Addr: string = await sales.token();
    const out = await erc20Data(erc20Addr);
    //const dp = getDecimals(erc20Addr);
    lg("token addr:", erc20Addr, ", out:", out);
    if (out.err) {
      console.error(funcName + ' -> erc20Data err:', out.err);
      return { ...evmSalesTokenDataD, err: out.err };
    }
    lg(funcName + ' success');
    return { ...evmSalesTokenDataD, ...out };
  } catch (err) {
    console.error(funcName + ':', err);
    return { ...evmSalesTokenDataD, err: err + '' };
  }
}

export const evmSalesPricesD = { ...evmSalesTokenDataD, priceArrStr: [] as string[] }
export const evmSalesPrices = async (tokenIds: number[], nftAddr: string, salesAddr: string) => {
  const funcName = 'evmSalesPrices'
  lg(funcName + '() in ethers.ts... tokenIds:', tokenIds, ', nftAddr:', nftAddr, ', salesAddr:', salesAddr);
  try {
    const out = await evmSalesTokenData(salesAddr)
    if (out.err) {
      return { ...evmSalesPricesD, err: out.err };
    }
    const decimals = out.decimals;
    const priceArrStr: string[] = []
    for (const id of tokenIds) {
      const out = await salesPrice(id, nftAddr, salesAddr, decimals);
      if (out.err) {
        priceArrStr.push(out.err);
      } else {
        priceArrStr.push(out.str1)
      }
    }
    lg(funcName + ' success');
    return { ...evmSalesPricesD, ...out, priceArrStr };
  } catch (err) {
    console.error(funcName + ':', err);
    return { ...evmSalesPricesD, err: funcName + ' failed' };
  }
}
/* decimals < 0 to get the token address from the sales contract, then to get decimals */
export const salesPrice = async (tokenId: number, nftAddr: string, salesAddr: string, decimals: number): Promise<OutT> => {
  const funcName = 'salesPrice'
  lg(funcName + '()... tokenId:', tokenId);
  if (tokenId < 0 || isEmpty(nftAddr) || isEmpty(salesAddr)) {
    return { ...out, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...out, err: 'provider invalid' };
  }
  try {
    const sales = new Contract(salesAddr, salesJSON.abi, provider);
    const out = await sales.prices(nftAddr, tokenId);

    let dp = decimals;
    if (decimals < 0) {
      const erc20Addr = await sales.token();
      dp = getDecimals(erc20Addr);
    }
    lg("dp:", dp, ", prices out:(inWeiETH, inWeiToken):", ...out);
    const { 0: priceInWeiETH, 1: priceInWeiToken } = out;
    //lg("priceInWeiETH:", priceInWeiETH, ', priceInWeiToken:', priceInWeiToken);

    const priceInEth = formatEther(priceInWeiETH);
    const priceInTokStr = formatUnits(priceInWeiToken, dp);

    lg(funcName + ' success. priceInEth:', priceInEth, ', priceInTokStr:', priceInTokStr);
    return { ...out, str1: priceInEth + '_' + priceInTokStr };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const getEvmBalances = async (account: string, tokenAddr: string, nftAddr: string, salesAddr: string): Promise<balancesT> => {
  const funcName = 'getEvmBalances';
  lg(funcName + ' in ethers.ts...');

  try {
    const oAccNative = await getBalanceEth(account)
    const oAccUSDT = await erc20BalanceOf(account, tokenAddr);
    const decimals = oAccUSDT.nums[0];
    const oAccDragonNFTids = await erc721TokenIds(account, nftAddr);
    const oSalesNative = await getBalanceEth(salesAddr)
    const oSalesUSDT = await erc20BalanceOf(salesAddr, tokenAddr);
    const oSalesNDragonNFTids = await erc721TokenIds(salesAddr, nftAddr);

    let err = ''
    if (oAccNative.err || oAccUSDT.err || oAccDragonNFTids.err || oSalesNative.err || oSalesUSDT.err || oSalesNDragonNFTids.err) err = oAccNative.err + ", " + oAccDragonNFTids.err + ", " + oSalesNative.err + ", " + oSalesUSDT.err + ", " + oSalesNDragonNFTids.err;

    const out = {
      accBalcNative: oAccNative.str1,
      accBalcToken: oAccUSDT.str1,
      accNftArray: oAccDragonNFTids.nums, salesBalcNative: oSalesNative.str1, salesBalcToken: oSalesUSDT.str1,
      salesNftArray: oSalesNDragonNFTids.nums, decimals, err,
    }
    lg(funcName + " out:", out)

    /*const ctrt = new Contract(ArrayOfStructsJSON.contractAddress, ArrayOfStructsJSON.abi, provider);
        lg("a103")
        let box0 = await ctrt.getBox(0);
        lg("box0:", box0)
        const { 0: num, 1: addr } = box0;
        lg("num:", num, ', addr:', addr)
    
        let box2 = await ctrt.getBox(2);
        lg("box2:", box2)
        let boxes = await ctrt.getBoxes(0, 2);
        lg("boxes:", boxes)
        let boxes2 = await ctrt.getBoxes2(0, 2);
        lg("boxes2:", boxes2)
        let uints = await ctrt.getBalances(tokenAddr, nftAddr);
        lg("uints:", uints)
        const { 0: oEthUser, 1: oTokUser, 2: oTokDp, 3: oNftUser, 4: oEthCtrt, 5: oTokCtrt, 6: oNftCtrt } = uints;
        lg(oEthUser, oTokUser, oTokDp, oNftUser, oEthCtrt, oTokCtrt, oNftCtrt);
    
        const out2 = await sales.getBalances();
        lg("out2:", out2); */
    lg(funcName + ' success');
    return out;
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...initBalancesDefault, err: funcName + ' failed' };
  }
}

export const buyNFTviaETH = async (tokenId: string, amountInEth: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = "buyNFTviaETH";
  lg(funcName + '()... tokenId:', tokenId, ', ctrtAddr:', ctrtAddr);
  const tokId = Number.parseInt(tokenId);
  if (isEmpty(tokenId) || isEmpty(ctrtAddr) || Number.isNaN(tokId)) {
    return { ...out, err: funcName + 'input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const sales = new Contract(ctrtAddr, salesJSON.abi, signer);

    const ownerOut = await sales.owner();
    lg("ownerOut:", ownerOut)

    const ok: boolean = await sales.checkBuying(tokId);
    lg("ok:", ok)
    if (!ok) return { ...out, err: 'input error' }

    const tx = await sales.buyNFTviaETH(tokId, {
      value: parseUnits(amountInEth, "ether")
    });
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //blockNumber, cumulativeGasUsed, gasPrice, gasUsed
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export const buyNFTviaERC20 = async (tokenId: string, ctrtAddr: string): Promise<OutT> => {
  const funcName = "buyNFTviaERC20";
  lg(funcName + '()... tokenId:', tokenId, ', ctrtAddr:', ctrtAddr);
  const tokId = Number.parseInt(tokenId);
  if (isEmpty(tokenId) || isEmpty(ctrtAddr) || Number.isNaN(tokId)) {
    return { ...out, err: funcName + 'input invalid' };
  } else if (!signer) {
    return { ...out, err: 'signer invalid' };
  }
  try {
    const sales = new Contract(ctrtAddr, salesJSON.abi, signer);

    const ownerOut = await sales.owner();
    lg("ownerOut:", ownerOut)

    const ok: boolean = await sales.checkBuying(tokId);
    lg("ok:", ok)
    if (!ok) return { ...out, err: 'input error' }

    const tx = await sales.buyNFTviaERC20(tokId);
    const receipt = await tx.wait();
    lg(funcName + ' success... txnHash:', receipt, receipt.hash);
    //blockNumber, cumulativeGasUsed, gasPrice, gasUsed
    return { ...out, str1: receipt.hash };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...out, err: funcName + ' failed' };
  }
}

export type nftSalesStatus = 'soldToUser' | 'soldToUnknown' | 'availableFromOriginalOwner' | 'availableFromOthers' | 'availableFromSalesCtrt' | 'notApproved';
export const nftStatusesDefault = {
  arr: [] as nftSalesStatus[],
  err: ''
}
export type nftStatusesT = typeof nftStatusesDefault;
export const checkEvmNftStatus = async (user: string, nftOriginalOwner: string, nftAddr: string, salesAddr: string, nftIdMin = 0, nftIdMax = 9): Promise<nftStatusesT> => {
  const funcName = 'checkNftStatus';
  lg(funcName + ' in ethers.ts...');
  lg(funcName + ". user:", user, ', nftAddr:', nftAddr, 'nftOriginalOwner:', nftOriginalOwner)
  if (isEmpty(nftAddr) || isEmpty(nftOriginalOwner)) {
    return { ...nftStatusesDefault, err: funcName + ' input invalid' };
  } else if (!provider) {
    return { ...nftStatusesDefault, err: 'provider invalid' };
  }
  try {
    const nft = new Contract(nftAddr, erc721JSON.abi, provider);

    const owners: string[] = await nft.ownerOfBatch(nftIdMin, nftIdMax);
    lg(funcName + '. owners:', ...owners);
    const approvedAddrs: string[] = await nft.getApprovedBatch(nftIdMin, nftIdMax);
    lg(funcName + ' approvedAddrs:', ...approvedAddrs);

    let arr: nftSalesStatus[] = [];
    for (let i = 0; i < owners.length; i++) {
      const isApproved = approvedAddrs[i] == salesAddr;
      const isNftOriginalOwner = owners[i] === nftOriginalOwner;
      if (isApproved) {
        if (isNftOriginalOwner) {
          arr.push('availableFromOriginalOwner');
        } else {
          arr.push('availableFromOthers');
        }
      } else if (owners[i] == salesAddr) {
        arr.push('availableFromSalesCtrt');

      } else if (!isEmpty(user) && owners[i] === user) {
        arr.push('soldToUser');
      } else {
        arr.push('soldToUnknown');
      }
    }
    lg(funcName + ' success');
    return { arr, err: '' };
  } catch (error) {
    console.error(funcName + ':', error);
    return { ...nftStatusesDefault, err: funcName + ' failed' };
  }
}

type addrName = 'erc20_usdt' | 'erc721Dragon' | 'erc721Sales' | 'nftOriginalOwner';//must match validator web3InputSchema
export const getEvmAddr = (ctrtName: addrName): string => {
  let ctrtAddr = '';
  if (contractsJSON.length < 3) {
    console.error("'Error contractsJSON.length < 3'")
    return 'Error contractsJSON.length < 3'
  }
  switch (ctrtName) {
    /*case 'goldCoin':
        ctrtAddr = goldcoinAddr === '' ? contractsJSON[3].contractAddress : goldcoinAddr;
      break; */
    case 'erc20_usdt':
      ctrtAddr = erc20_usdtAddr;
      break;
    case 'erc721Dragon':
      ctrtAddr = erc721Addr;
      break;
    case 'erc721Sales':
      ctrtAddr = salesAddr === '' ? contractsJSON[2].contractAddress : salesAddr;
      break;
    case 'nftOriginalOwner':
      ctrtAddr = process.env.NEXT_PUBLIC_ETHEREUM_NFT_ORIGINAL_OWNER || '';
      break;
  }
  return ctrtAddr;
};

export const getDecimals = (addr: string) => {
  //console.log('getDecimals()... input:', input);
  let decimals = 18;
  if (ethereumNetwork === 'anvil') {
    switch (addr) {
      case erc20JSON.contractAddress:
        decimals = 6;
        break;
      default:
        decimals = 18;
    }
  } else {//for any remote network, set the addresses in the .env file
    switch (addr) {
      case erc20_usdtAddr:
        decimals = 6;
        break;
      default:
        decimals = 18;
    }
  }
  return decimals;
}
export const getChainObj = (input: string) => {
  //console.log('getChainObj()... input:', input);
  let chainHex = '', chainName = '', chainId = '';
  switch (input) {
    case 'ethereum':
    case '0x1':
      chainHex = '0x1';
      chainName = 'mainnet';
      chainId = '1'
      break;
    case 'sepolia':
    case '0xaa36a7':
      chainHex = '0xaa36a7';
      chainName = 'sepolia';
      chainId = '11155111'
      break;
    case 'goerli':
    case '0x5':
      chainHex = '0x5';
      chainName = 'goerli';
      chainId = ''
      break;
    case 'polygon':
    case '0x89':
      chainHex = '0x89';
      chainName = 'polygon';
      chainId = '137'
      break;
    case 'mumbai':
    case '0x13881':
      chainHex = '0x13881';
      chainName = 'mumbai';
      chainId = '80001'
      break;
    case 'bsc':
    case '0x38':
      chainHex = '0x38';
      chainName = 'bsc';
      chainId = ''
      break;
    case 'bsc_testnet':
    case '0x61':
      chainHex = '0x61';
      chainName = 'bsc_testnet';
      chainId = '97'
      break;
    case 'avalanche':
    case '0xa86a':
      chainHex = '0xa86a';
      chainName = 'avalanche';
      chainId = ''
      break;
    case 'fantom':
    case '0xfa':
      chainHex = '0xfa';
      chainName = 'fantom';
      chainId = ''
      break;
    case 'cronos':
    case '0x19':
      chainHex = '0x19';
      chainName = 'cronos';
      chainId = ''
      break;
    case 'palm':
    case '0x2a15c308d':
      chainHex = '0x2a15c308d';
      chainName = 'palm';
      chainId = ''
      break;
    case 'arbitrum':
    case '0xa4b1':
      chainHex = '0xa4b1';
      chainName = 'arbitrum';
      chainId = ''
      break;
    case 'anvil':
    case '0x7a69':
      chainHex = '';
      chainName = 'anvil';
      chainId = 'anvil'
      break;
    case 'hardhat':
    case '0x539':
      chainHex = '';
      chainName = 'hardhat';
      chainId = 'hardhat'
      break;
    default:
      chainHex = 'invalid';
      chainName = 'invalid';
      chainId = 'invalid'
  }
  return { chainHex, chainName, chainId };
}