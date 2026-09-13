package network.zoryq.wallet.migration

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.web3j.crypto.Credentials

class EthereumSignatureTest {
    private val credentials = Credentials.create(
        "0000000000000000000000000000000000000000000000000000000000000001"
    )

    @Test
    fun personalSignatureIsCanonical65Bytes() {
        val signature = EthereumSignature.personal("ZORYQ Social Sign-In", credentials)
        assertTrue(signature.startsWith("0x"))
        assertEquals(132, signature.length)
    }

    @Test
    fun typedDataSignatureIsCanonical65Bytes() {
        val typedData = """
            {
              "types": {
                "EIP712Domain": [
                  {"name":"name","type":"string"},
                  {"name":"version","type":"string"},
                  {"name":"chainId","type":"uint256"}
                ],
                "ProfileRegistration": [
                  {"name":"wallet","type":"address"},
                  {"name":"handle","type":"string"},
                  {"name":"displayName","type":"string"},
                  {"name":"bio","type":"string"},
                  {"name":"nonce","type":"bytes32"},
                  {"name":"issuedAt","type":"uint256"},
                  {"name":"expiresAt","type":"uint256"}
                ]
              },
              "primaryType":"ProfileRegistration",
              "domain":{"name":"ZORYQ Profile Registry","version":"1","chainId":5919065},
              "message":{
                "wallet":"0x0000000000000000000000000000000000000001",
                "handle":"zoryq_user",
                "displayName":"zoryq_user",
                "bio":"ZORYQ mobile profile",
                "nonce":"0x0000000000000000000000000000000000000000000000000000000000000001",
                "issuedAt":1,
                "expiresAt":2
              }
            }
        """.trimIndent()

        val signature = EthereumSignature.typedData(typedData, credentials)
        assertTrue(signature.startsWith("0x"))
        assertEquals(132, signature.length)
    }
}
