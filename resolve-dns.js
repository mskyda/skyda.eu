const axios = require('axios');
const publicIP = require('public-ip');

const requestConfig = {
    headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json'
    }
};

checkIP();

async function checkIP(currentIP) {

    const newIP = await publicIP.v4();

    if(!newIP){

        console.info(`${(new Date).getTime()} [DNS]: unable to fetch IP`);

    } else if(currentIP !== newIP){

        if(currentIP){
            console.info(`${(new Date).getTime()} [DNS]: IP has changed from ${currentIP} to ${newIP}`);
        } else {
            console.info(`${(new Date).getTime()} [DNS]: first run. set current IP to ${newIP}`);
        }

        await updateDNSRecords(newIP);

        currentIP = newIP;

    }

    setTimeout(() => { checkIP(currentIP); },  5 * 60000);

}

async function updateDNSRecords(newIP) {

    const dnsRecords = await getDNSRecords();
    console.info(`[DNS]: fetched ${dnsRecords.length} records`);

    const excludedRecords = process.env.EXCLUDED_DNS_RECORDS ? process.env.EXCLUDED_DNS_RECORDS.split('|') : [];

    for (const record of dnsRecords) {
        if(~excludedRecords.indexOf(record.name)){
            console.info(`[DNS]: record "${record.name}" is excluded`);
        } else if(record.type !== 'A') {
            console.info(`[DNS]: record "${record.name}" is not an A record`);
        } else {
            console.info(`[DNS]: update record "${record.name}"`);
            await updateDNSRecord(record, newIP);
        }
    }

}

async function getDNSRecords() {

    const getEndpoint = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`;
    const {data} = await axios.get(getEndpoint, requestConfig);

    return data && data.result;
}

async function updateDNSRecord({id, type, name, proxied}, newIP) {

    const updateEndpoint = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records/${id}`;
    const updateData = {type, name, proxied, content: newIP};

    await axios.put(updateEndpoint, updateData, requestConfig);

}