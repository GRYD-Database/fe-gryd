const Web3 = require('web3')
const Web3Model = require('web3modal')
// Function to call the smart contract function and send data to the backend API
async function SendData() {
    const config = await fetchConfig();
    if (!config) return;

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    let outputHtml;
    if (document.getElementById("fileInput").value === "") {
        const outputElement = document.getElementById('output');
        outputHtml = `<pre class="error" style="color: #f44336">No file has been selected</pre>`;
        outputElement.innerHTML = outputHtml;
        return;
    } else {
        if (file.type !== "text/csv") {
            const outputElement = document.getElementById('output');
            outputHtml = `<pre class="error" style="color: #f44336">Only csv files are supported</pre>`;
            outputElement.innerHTML = outputHtml;
            return;
        }

        const outputElement = document.getElementById('output');
        outputElement.innerHTML = "";
    }

    // Read the file content
    const fileReader = new FileReader();
    fileReader.onload = async function (event) {
        const fileContent = event.target.result;

        // Instantiate web3 provider
        let web3Provider;
        if (!config.privateKey) {
            const web3Modal = new Web3Modal // Initialize web3modal without any specific options
            web3Provider = await web3Modal.connect();
        } else {
            web3Provider = new Web3.providers.HttpProvider(config.providerUrl);
        }

        // Instantiate web3 with the selected provider
        const web3 = new Web3(web3Provider);

        // Get the contract address from config
        const contractAddress = config.contractAddress;

        // Get the contract ABI from config
        const contractABI = config.contractABI;

        // Instantiate the contract object
        const contract = new web3.eth.Contract(contractABI, contractAddress);

        // Prepare the transaction object
        const privateKey = config.privateKey;
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const nonce = await web3.eth.getTransactionCount(account.address);

        const functionName = 'create';
        const functionAbi = contractABI.find((abi) => abi.name === functionName);
        const functionSignature = web3.eth.abi.encodeFunctionSignature(functionAbi);

        const inputData = contract.methods[functionName]().encodeABI();
        const data = functionSignature + inputData.substr(2);

        const transactionObject = {
            from: account.address,
            to: contractAddress,
            gas: 2000000,
            maxPriorityFeePerGas: web3.utils.toWei('2', 'gwei'), // Set the desired maximum priority fee per gas
            maxFeePerGas: web3.utils.toWei('100', 'gwei'), // Set the desired maximum fee per gas
            nonce,
            data,
        };

        // Sign the transaction
        const signedTransaction = await web3.eth.accounts.signTransaction(transactionObject, privateKey);

        // Call the smart contract function
        try {
            const rawTransaction = signedTransaction.rawTransaction;
            const transaction = web3.eth.sendSignedTransaction(rawTransaction);

            transaction.on('transactionHash', async (hash) => {
                console.log('Transaction Hash:', hash);

                // Wait for the smart contract transaction to be mined
                await transaction;

                // Prepare form data with file, response, and transaction hash
                const formData = new FormData();
                formData.append('file', file, file.name); // Append the file with its original name
                formData.append('wallet', account.address);
                formData.append('txHash', hash);

                // Make the API call
                const url = config.backendApiUrl;
                const options = {
                    method: 'POST',
                    body: formData,
                };

                try {
                    const responseApi = await fetch(url, options);
                    if (!responseApi.ok) {
                        throw new Error(`HTTP Error: ${responseApi.status} ${responseApi.statusText}`);
                    }
                    let responseData = await responseApi.text();

                    let outputHtml;
                    try {
                        const formattedData = JSON.stringify(JSON.parse(responseData), null, 2);
                        outputHtml = `<pre>${formattedData}</pre>`;
                    } catch (error) {
                        // Error response is not valid JSON, display as plain text
                        outputHtml = `<pre class="error">${responseData.trim()}</pre>`;
                    }

                    console.log('Backend API Response:', responseData);

                    // Display the response in the output field
                    const outputElement = document.getElementById('output');
                    outputElement.innerHTML = outputHtml;

                    // Process the API response here
                } catch (error) {
                    console.error('Error:', error);
                    // Display the error message in the output field
                    const outputElement = document.getElementById('output');
                    outputElement.innerHTML = `<pre class="error">${error.message}</pre>`;
                }
            });

            transaction.on('error', (error) => {
                console.error('Error:', error);
            });
        } catch (error) {
            console.error('Error:', error);
        }
    };

    fileReader.readAsText(file); // Read the file as text
}


// Function to fetch the configuration values from config.json
async function fetchConfig() {
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Error fetching config:', error);
    }
}

// Attach the event listener to the window object to make the function accessible globally
window.addEventListener('load', () => {
    const sendButton = document.getElementById('sendButton');
    sendButton.addEventListener('click', SendData);
});
