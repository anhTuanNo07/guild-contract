import { fromRpcSig } from "ethereumjs-util"

export async function signGuildTicketClaim(
    guildContract: any,
    amount: number, 
    checkpoint: number,
    signer: any,
    signee: any
) {
    // Sign for minter create guild
    const deadline = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 // 24 hours
    let nonce

    try {
    nonce = (await guildContract.getSigNonce(signee.address)).toNumber()
    } catch (e) {
        console.error('NONCE', e)
        return
    }

    try {
    const types = {
        ClaimGuildTicketWithSig: [
        { name: 'memberAddress', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'checkpoint', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        ],
    }

    const domain = {
        name: 'Guild',
        version: '1',
        verifyingContract: guildContract.address,
    }

    const message = {
        memberAddress: signee.address,
        amount: amount,
        checkpoint: checkpoint,
        nonce,
        deadline,
    }

    const sig = await signer._signTypedData(domain, types, message)
    const response = fromRpcSig(sig)
    // get signature
    let signatureRes = {
        r: response.r,
        s: response.s,
        v: response.v,
        deadline: deadline.toString(),
    }

    return signatureRes
    } catch (e: any) {
    console.error(e.message, "Signature error")
    }
}
